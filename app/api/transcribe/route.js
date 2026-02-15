/**
 * POST /api/transcribe - 音声文字起こし（非推奨: Storage + Edge Function に移行予定）
 * GET  /api/transcribe - セグメント一覧取得
 */

import { withApi } from '@/lib/middleware.js'
import { prisma } from '@/lib/prisma.js'
import { transcribeAudio } from '@/lib/gemini.js'
import { STT_STATUS, SESSION_STATUS } from '@/lib/constants.js'
import { ValidationError, AppError } from '@/lib/errors.js'

const MAX_AUDIO_SIZE = 6 * 1024 * 1024 // 6MB
const ALLOWED_MIME = ['audio/mp4', 'audio/mpeg', 'audio/m4a', 'audio/aac', 'audio/wav']

export const POST = withApi(async (request, { userId }) => {
  // Deprecation警告
  console.warn('[DEPRECATED] POST /api/transcribe — migrate to Storage + Edge Function process-audio')

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
  const text = await transcribeAudio(buffer, audioFile.type || 'audio/mp4', userId)

  let session = await prisma.session.findFirst({
    where: { deviceId, userId, status: SESSION_STATUS.ACTIVE },
    orderBy: { startedAt: 'desc' },
  })

  if (!session) {
    session = await prisma.session.create({
      data: { userId, deviceId, status: SESSION_STATUS.ACTIVE },
    })
  }

  const segment = await prisma.segment.upsert({
    where: {
      sessionId_segmentNo: { sessionId: session.id, segmentNo },
    },
    update: {
      text,
      startAt: startAt ? new Date(startAt) : new Date(),
      endAt: endAt ? new Date(endAt) : new Date(),
      sttStatus: STT_STATUS.DONE,
    },
    create: {
      sessionId: session.id,
      userId,
      segmentNo,
      startAt: startAt ? new Date(startAt) : new Date(),
      endAt: endAt ? new Date(endAt) : new Date(),
      text,
      sttStatus: STT_STATUS.DONE,
    },
  })

  return {
    segment: {
      id: segment.id,
      sessionId: session.id,
      segmentNo,
      text,
      sttStatus: segment.sttStatus,
    },
    _deprecated: 'This endpoint is deprecated. Use Storage upload + Edge Function process-audio instead.',
  }
}, { rateLimit: { requests: 10, window: '1 m' } })

export const GET = withApi(async (request, { userId }) => {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  const where = { userId }
  if (sessionId) where.sessionId = sessionId

  const segments = await prisma.segment.findMany({
    where,
    orderBy: [
      { sessionId: 'desc' },
      { segmentNo: 'asc' },
    ],
    take: 100,
  })

  return { segments }
})
