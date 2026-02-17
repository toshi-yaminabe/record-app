/**
 * GET  /api/segments - セグメント一覧取得
 * POST /api/segments - セグメント作成（PENDINGステータス）
 */

import { withApi } from '@/lib/middleware.js'
import { listSegments, createSegment } from '@/lib/services/segment-service.js'
import { ValidationError } from '@/lib/errors.js'
import { validateBody, segmentCreateSchema } from '@/lib/validators.js'

export const GET = withApi(async (request, { userId }) => {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  const rawLimit = parseInt(searchParams.get('limit') || '100', 10)
  const limit = (Number.isFinite(rawLimit) && rawLimit >= 1) ? Math.min(rawLimit, 200) : 100

  const segments = await listSegments(userId, { sessionId, limit })
  return { segments }
})

export const POST = withApi(async (request, { userId }) => {
  const body = await request.json()
  const validated = validateBody(segmentCreateSchema, body)
  const { sessionId, segmentNo, startAt, endAt, storageObjectPath } = validated

  if (!sessionId) {
    throw new ValidationError('sessionId is required')
  }
  if (segmentNo === undefined || segmentNo === null) {
    throw new ValidationError('segmentNo is required')
  }

  const segment = await createSegment(userId, {
    sessionId,
    segmentNo,
    startAt: startAt || new Date().toISOString(),
    endAt: endAt || new Date().toISOString(),
    storageObjectPath,
  })
  return { segment }
})
