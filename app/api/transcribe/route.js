import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { transcribeAudio } from '@/lib/gemini'
import { MOCK_USER_ID, STT_STATUS } from '@/lib/constants'
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

    // 1. DBに保存（Transcript - 既存動作）
    const transcript = await prisma.transcript.create({
      data: {
        deviceId,
        sessionId,
        segmentNo,
        startAt: startAt ? new Date(startAt) : new Date(),
        endAt: endAt ? new Date(endAt) : new Date(),
        text
      }
    })

    // 2. Sessionを検索または作成
    let session = await prisma.session.findFirst({
      where: { deviceId, userId: MOCK_USER_ID, status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
    })

    if (!session) {
      session = await prisma.session.create({
        data: { userId: MOCK_USER_ID, deviceId, status: 'ACTIVE' },
      })
    }

    // 3. Segment作成
    const segment = await prisma.segment.create({
      data: {
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
      success: true,
      transcriptId: transcript.id,
      segmentId: segment.id,
      text
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
    const deviceId = searchParams.get('deviceId')
    const sessionId = searchParams.get('sessionId')

    const where = {}
    if (deviceId) where.deviceId = deviceId
    if (sessionId) where.sessionId = sessionId

    const transcripts = await prisma.transcript.findMany({
      where,
      orderBy: [
        { sessionId: 'desc' },
        { segmentNo: 'asc' }
      ],
      take: 100
    })

    return NextResponse.json({ transcripts })
  } catch (error) {
    console.error('Get transcripts error:', error)
    return errorResponse(error)
  }
}
