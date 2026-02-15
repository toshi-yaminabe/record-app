/**
 * POST /api/sessions - セッション作成
 * GET  /api/sessions - セッション一覧取得
 */

import { withApi } from '@/lib/middleware.js'
import { createSession, listSessions } from '@/lib/services/session-service.js'
import { ValidationError } from '@/lib/errors.js'

export const POST = withApi(async (request, { userId }) => {
  const body = await request.json()
  const { deviceId } = body

  if (!deviceId || typeof deviceId !== 'string') {
    throw new ValidationError('deviceId is required')
  }

  const session = await createSession(userId, { deviceId })
  return { session }
})

export const GET = withApi(async (request, { userId }) => {
  const { searchParams } = new URL(request.url)
  const rawLimit = parseInt(searchParams.get('limit') || '50', 10)
  const limit = (Number.isFinite(rawLimit) && rawLimit >= 1) ? Math.min(rawLimit, 200) : 50

  const sessions = await listSessions(userId, { limit })
  return { sessions }
})
