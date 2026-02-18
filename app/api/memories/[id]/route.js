/**
 * GET /api/memories/[id] - メモリー取得
 *
 * NOTE: PATCH (メモリーテキスト更新) は廃止済み。
 * memory-service.js の updateMemoryText を参照のこと。
 */

import { withApi } from '@/lib/middleware.js'
import { getMemory } from '@/lib/services/memory-service.js'

export const GET = withApi(async (request, { userId, params }) => {
  const { id } = params
  const memory = await getMemory(userId, id)
  return { memory }
})
