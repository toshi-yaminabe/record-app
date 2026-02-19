/**
 * POST /api/transcribe - 音声文字起こし（multipart POST）
 * GET  /api/transcribe - セグメント一覧取得
 */

import { withApi } from '@/lib/middleware.js'
import { AppError, ValidationError } from '@/lib/errors.js'
import { transcribeSegment } from '@/lib/services/transcribe-service.js'
import { listSegments } from '@/lib/services/segment-service.js'

const MAX_AUDIO_SIZE = 6 * 1024 * 1024 // 6MB
const ALLOWED_MIME = ['audio/mp4', 'audio/mpeg', 'audio/m4a', 'audio/aac', 'audio/wav']

export const POST = withApi(async (request, { userId }) => {
  // Content-Lengthで早期にファイルサイズ超過を検出
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10)
  if (contentLength > MAX_AUDIO_SIZE) {
    throw new AppError('Audio file too large (max 6MB)', 413)
  }

  const formData = await request.formData()
  const audioFile = formData.get('audio')
  const deviceId = formData.get('deviceId')
  const sessionId = formData.get('sessionId')
  const segmentNo = parseInt(formData.get('segmentNo') || '0', 10)
  const startAt = formData.get('startAt')
  const endAt = formData.get('endAt')

  if (!audioFile || !deviceId || !sessionId) {
    throw new ValidationError('Missing required fields: audio, deviceId, sessionId')
  }

  if (audioFile.size > MAX_AUDIO_SIZE) {
    throw new AppError('Audio file too large (max 6MB)', 413)
  }
  if (audioFile.type && !ALLOWED_MIME.includes(audioFile.type)) {
    throw new AppError('Unsupported audio format', 415)
  }

  const arrayBuffer = await audioFile.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { segment, sessionId: resolvedSessionId, text } = await transcribeSegment(userId, {
    audioBuffer: buffer,
    mimeType: audioFile.type || 'audio/mp4',
    sessionId,
    segmentNo,
    startAt,
    endAt,
    deviceId,
  })

  return {
    segment: {
      id: segment.id,
      sessionId: resolvedSessionId,
      segmentNo,
      text,
      sttStatus: segment.sttStatus,
    },
  }
}, { rateLimit: { requests: 10, window: '1 m' } })

export const GET = withApi(async (request, { userId }) => {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  const segments = await listSegments(userId, {
    sessionId: sessionId || undefined,
    limit: 100,
  })

  return { segments }
})
