/**
 * GET  /api/proposals - 提案一覧取得
 * POST /api/proposals - 日次提案生成
 */

import { withApi } from '@/lib/middleware.js'
import { listProposals, generateDailyProposals } from '@/lib/services/proposal-service.js'
import { validateBody, proposalCreateSchema } from '@/lib/validators.js'

export const GET = withApi(async (request, { userId }) => {
  const { searchParams } = new URL(request.url)
  const dateKey = searchParams.get('dateKey')
  const status = searchParams.get('status')

  const proposals = await listProposals(userId, {
    dateKey: dateKey || undefined,
    status: status || undefined,
  })
  return { proposals }
})

export const POST = withApi(async (request, { userId }) => {
  const body = await request.json()
  const validated = validateBody(proposalCreateSchema, body)
  const { dateKey } = validated

  const proposals = await generateDailyProposals(userId, dateKey)
  return { proposals }
}, { rateLimit: { requests: 5, window: '1 m' } })
