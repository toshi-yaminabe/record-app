import { NextResponse } from 'next/server'
import { transcribeAudio } from '@/lib/gemini'

// Prismaはオプショナル（DB保存が必要な場合のみ）
let prisma = null
try {
  if (process.env.DATABASE_URL) {
    const { prisma: prismaClient } = await import('@/lib/prisma')
    prisma = prismaClient
  }
} catch (e) {
  console.log('Prisma not available, running without DB')
}

export async function POST(request) {
  try {
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

    // 音声ファイルをバッファに変換
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Gemini Flashで文字起こし
    const text = await transcribeAudio(buffer, audioFile.type || 'audio/mp4')

    // DBが利用可能な場合のみ保存
    let transcriptId = `temp-${Date.now()}`
    if (prisma) {
      try {
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
        transcriptId = transcript.id
      } catch (dbError) {
        console.log('DB save skipped:', dbError.message)
      }
    }

    return NextResponse.json({
      success: true,
      transcriptId,
      text
    })
  } catch (error) {
    console.error('Transcribe error:', error)
    return NextResponse.json(
      { error: error.message || 'Transcription failed' },
      { status: 500 }
    )
  }
}

// 文字起こし履歴を取得
export async function GET(request) {
  try {
    // DBが利用できない場合は空配列を返す
    if (!prisma) {
      return NextResponse.json({
        transcripts: [],
        message: 'Database not configured. Set DATABASE_URL to enable history.'
      })
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
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
