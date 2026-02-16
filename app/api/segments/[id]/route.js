/**
 * セグメントAPI - 詳細取得・STTステータス更新
 */

import { withApi } from '@/lib/middleware'
import { getSegment, updateSegmentSttStatus } from '@/lib/services/segment-service'

/**
 * GET /api/segments/:id
 * セグメント詳細を取得
 */
export const GET = withApi(async (request, { userId, params }) => {
  const { id } = params
  return getSegment(userId, id)
})

/**
 * PATCH /api/segments/:id
 * セグメントのSTTステータスを更新
 */
export const PATCH = withApi(async (request, { userId, params }) => {
  const { id } = params
  const body = await request.json()
  const { sttStatus, text } = body

  if (!sttStatus && text === undefined) {
    const { ValidationError } = await import('@/lib/errors')
    throw new ValidationError('At least one field required: sttStatus, text')
  }

  return updateSegmentSttStatus(userId, id, { sttStatus, text })
})
