/**
 * PATCH  /api/bunjins/[id] - 分人更新
 * DELETE /api/bunjins/[id] - カスタム分人削除
 */

import { withApi } from '@/lib/middleware.js'
import { updateBunjin, deleteBunjin } from '@/lib/services/bunjin-service.js'
import { validateBody, bunjinUpdateSchema } from '@/lib/validators.js'

export const PATCH = withApi(async (request, { userId, params }) => {
  const { id } = params
  const body = await request.json()
  const validated = validateBody(bunjinUpdateSchema, body)
  const bunjin = await updateBunjin(userId, id, validated)
  return { bunjin }
})

export const DELETE = withApi(async (request, { userId, params }) => {
  const { id } = params
  await deleteBunjin(userId, id)
  return null
})
