/**
 * PATCH  /api/bunjins/[id] - 分人更新
 * DELETE /api/bunjins/[id] - カスタム分人削除
 */

import { withApi } from '@/lib/middleware.js'
import { updateBunjin, deleteBunjin } from '@/lib/services/bunjin-service.js'

export const PATCH = withApi(async (request, { userId, params }) => {
  const { id } = params
  const body = await request.json()
  const bunjin = await updateBunjin(userId, id, body)
  return { bunjin }
})

export const DELETE = withApi(async (request, { userId, params }) => {
  const { id } = params
  await deleteBunjin(userId, id)
  return null
})
