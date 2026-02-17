/**
 * GET  /api/bunjins - 全分人取得
 * POST /api/bunjins - カスタム分人作成
 */

import { withApi } from '@/lib/middleware.js'
import { listBunjins, createBunjin } from '@/lib/services/bunjin-service.js'
import { validateBody, bunjinCreateSchema } from '@/lib/validators.js'

export const GET = withApi(async (request, { userId }) => {
  const bunjins = await listBunjins(userId)
  return { bunjins }
})

export const POST = withApi(async (request, { userId }) => {
  const body = await request.json()
  const validated = validateBody(bunjinCreateSchema, body)
  const { slug, displayName, description, color, icon } = validated
  const bunjin = await createBunjin(userId, { slug, displayName, description, color, icon })
  return { bunjin }
})
