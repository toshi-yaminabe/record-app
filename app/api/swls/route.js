/**
 * GET  /api/swls - SWLS回答取得
 * POST /api/swls - SWLS回答作成/更新
 */

import { withApi } from '@/lib/middleware.js'
import { getSwlsResponse, upsertSwlsResponse } from '@/lib/services/swls-service.js'
import { getTodayDateKey, validateBody, swlsSchema } from '@/lib/validators.js'

export const GET = withApi(async (request, { userId }) => {
  const { searchParams } = new URL(request.url)
  const dateKey = searchParams.get('dateKey') || getTodayDateKey()

  const response = await getSwlsResponse(userId, dateKey)
  return { response }
})

export const POST = withApi(async (request, { userId }) => {
  const body = await request.json()
  const validated = validateBody(swlsSchema, body)
  const { dateKey = getTodayDateKey(), q1, q2, q3, q4, q5 } = validated

  const response = await upsertSwlsResponse(userId, { dateKey, q1, q2, q3, q4, q5 })
  return { response }
})
