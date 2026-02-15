/**
 * GET   /api/sessions/[id] - セッション詳細取得
 * PATCH /api/sessions/[id] - セッション停止
 */

import { withApi } from '@/lib/middleware.js'
import { getSession, stopSession } from '@/lib/services/session-service.js'

export const GET = withApi(async (request, { userId, params }) => {
  const { id } = params
  const session = await getSession(userId, id)
  return { session }
})

export const PATCH = withApi(async (request, { userId, params }) => {
  const { id } = params
  const session = await stopSession(userId, id)
  return { session }
})
