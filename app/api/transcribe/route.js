import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { transcribeAudio } from '@/lib/gemini'

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

    // DBに保存
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

    return NextResponse.json({
      success: true,
      transcriptId: transcript.id,
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
