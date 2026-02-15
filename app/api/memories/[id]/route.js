/**
 * PATCH /api/memories/[id] - メモリーテキスト更新
 */

import { withApi } from '@/lib/middleware.js'
import { updateMemoryText } from '@/lib/services/memory-service.js'
import { ValidationError } from '@/lib/errors.js'

export const PATCH = withApi(async (request, { userId, params }) => {
  const { id } = params
  const body = await request.json()
  const { text } = body

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new ValidationError('text is required and must be a non-empty string')
  }
  if (text.length > 50000) {
    throw new ValidationError('text must be at most 50000 characters')
  }

  const memory = await updateMemoryText(userId, id, text.trim())
  return { memory }
})
