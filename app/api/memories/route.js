/**
 * GET  /api/memories - メモリー一覧取得
 * POST /api/memories - メモリー作成
 */

import { withApi } from '@/lib/middleware.js'
import { listMemories, createMemory } from '@/lib/services/memory-service.js'
import { ValidationError } from '@/lib/errors.js'

export const GET = withApi(async (request, { userId }) => {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '50', 10)

  if (isNaN(limit) || limit < 1 || limit > 200) {
    throw new ValidationError('limit must be between 1 and 200')
  }

  const memories = await listMemories(userId, { limit })
  return { memories }
})

export const POST = withApi(async (request, { userId }) => {
  const body = await request.json()
  const { text, bunjinId, sourceRefs } = body

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new ValidationError('text is required and must be a non-empty string')
  }

  const memory = await createMemory(userId, {
    text: text.trim(),
    bunjinId: bunjinId || undefined,
    sourceRefs: sourceRefs || undefined,
  })
  return { memory }
})
