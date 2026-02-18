/**
 * POST /api/transcribe - 音声文字起こし（multipart POST）
 * GET  /api/transcribe - セグメント一覧取得
 */

import { withApi } from '@/lib/middleware.js'
import { transcribeAudio } from '@/lib/gemini.js'
import { AppError, ValidationError } from '@/lib/errors.js'
import { findOrCreateSession } from '@/lib/services/session-service.js'
import { createOrUpdateSegment, listSegments } from '@/lib/services/segment-service.js'

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

  let text
  try {
    text = await transcribeAudio(buffer, audioFile.type || 'audio/mp4', userId)
  } catch (error) {
    // Geminiタイムアウトエラーを検出して504を返す
    if (error.message?.includes('timeout')) {
      throw new AppError('Gemini API request timeout. Please try again.', 504)
    }
    // Gemini APIエラー（rate limit等）を検出して502を返す
    if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
      throw new AppError('Gemini API rate limit exceeded. Please wait and try again.', 502)
    }
    // その他のGemini APIエラーも502として扱う
    if (error.message?.includes('GEMINI_API_KEY') || error.message?.includes('API')) {
      throw new AppError('Gemini API error. Please check configuration.', 502)
    }
    // その他の予期しないエラーは再スロー
    throw error
  }

  const session = await findOrCreateSession(userId, { deviceId })

  const segment = await createOrUpdateSegment(userId, {
    sessionId: session.id,
    segmentNo,
    text,
    startAt,
    endAt,
  })

  return {
    segment: {
      id: segment.id,
      sessionId: session.id,
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
