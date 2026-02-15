/**
 * GET  /api/weekly-review - 週次実行記録取得
 * POST /api/weekly-review - 週次実行記録作成
 */

import { withApi } from '@/lib/middleware.js'
import { getWeeklyReview, createWeeklyExecution } from '@/lib/services/weekly-service.js'
import { ValidationError } from '@/lib/errors.js'

export const GET = withApi(async (request, { userId }) => {
  const { searchParams } = new URL(request.url)
  const weekKey = searchParams.get('weekKey')

  if (!weekKey) {
    throw new ValidationError('weekKey query parameter is required')
  }

  const executions = await getWeeklyReview(userId, weekKey)
  return { executions }
})

export const POST = withApi(async (request, { userId }) => {
  const body = await request.json()
  const { weekKey, proposalId, note } = body

  if (!weekKey || !proposalId) {
    throw new ValidationError('weekKey and proposalId are required')
  }

  const execution = await createWeeklyExecution(userId, { weekKey, proposalId, note })
  return { execution }
})
