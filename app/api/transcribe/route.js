import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { transcribeAudio } from '@/lib/gemini'
import { MOCK_USER_ID, STT_STATUS, SESSION_STATUS } from '@/lib/constants'
import { errorResponse } from '@/lib/errors'

const MAX_AUDIO_SIZE = 6 * 1024 * 1024 // 6MB
const ALLOWED_MIME = ['audio/mp4', 'audio/mpeg', 'audio/m4a', 'audio/aac', 'audio/wav']

export async function POST(request) {
  try {
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      )
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio')
    const deviceId = formData.get('deviceId')
    const sessionId = formData.get('sessionId')
    const segmentNo = parseInt(formData.get('segmentNo') || '0', 10)
    const startAt = formData.get('startAt')
    const endAt = formData.get('endAt')

    if (!audioFile || !deviceId || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: audio, deviceId, sessionId' },
        { status: 400 }
      )
    }

    // 音声ファイル検証
    if (audioFile.size > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        { error: 'Audio file too large (max 6MB)' },
        { status: 413 }
      )
    }
    if (audioFile.type && !ALLOWED_MIME.includes(audioFile.type)) {
      return NextResponse.json(
        { error: 'Unsupported audio format' },
        { status: 415 }
      )
    }

    // 音声ファイルをバッファに変換
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Gemini Flashで文字起こし
    const text = await transcribeAudio(buffer, audioFile.type || 'audio/mp4')

    // Sessionを検索または作成
    let session = await prisma.session.findFirst({
      where: { deviceId, userId: MOCK_USER_ID, status: SESSION_STATUS.ACTIVE },
      orderBy: { startedAt: 'desc' },
    })

    if (!session) {
      session = await prisma.session.create({
        data: { userId: MOCK_USER_ID, deviceId, status: SESSION_STATUS.ACTIVE },
      })
    }

    // Segment upsert（冪等性確保: 同一sessionId+segmentNoで重複送信されても安全）
    const segment = await prisma.segment.upsert({
      where: {
        sessionId_segmentNo: {
          sessionId: session.id,
          segmentNo,
        },
      },
      update: {
        text,
        startAt: startAt ? new Date(startAt) : new Date(),
        endAt: endAt ? new Date(endAt) : new Date(),
        sttStatus: STT_STATUS.DONE,
      },
      create: {
        sessionId: session.id,
        userId: MOCK_USER_ID,
        segmentNo,
        startAt: startAt ? new Date(startAt) : new Date(),
        endAt: endAt ? new Date(endAt) : new Date(),
        text,
        sttStatus: STT_STATUS.DONE,
      },
    })

    return NextResponse.json({
      segment: {
        id: segment.id,
        sessionId: session.id,
        segmentNo,
        text,
        sttStatus: segment.sttStatus,
      },
    })
  } catch (error) {
    console.error('Transcribe error:', error)
    return errorResponse(error)
  }
}

// 文字起こし履歴を取得
export async function GET(request) {
  try {
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      )
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    const where = { userId: MOCK_USER_ID }
    if (sessionId) where.sessionId = sessionId

    const segments = await prisma.segment.findMany({
      where,
      orderBy: [
        { sessionId: 'desc' },
        { segmentNo: 'asc' }
      ],
      take: 100
    })

    return NextResponse.json({ segments })
  } catch (error) {
    console.error('Get segments error:', error)
    return errorResponse(error)
  }
}
