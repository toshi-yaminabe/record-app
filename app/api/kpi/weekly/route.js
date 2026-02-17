/**
 * GET /api/kpi/weekly - 週次KPI取得
 *
 * Query: ?weekKey=YYYY-Wxx (必須)
 */

import { withApi } from '@/lib/middleware.js'
import { getWeeklyKpi } from '@/lib/services/kpi-service.js'
import { ValidationError } from '@/lib/errors.js'

export const GET = withApi(async (request, { userId }) => {
  const { searchParams } = new URL(request.url)
  const weekKey = searchParams.get('weekKey')

  if (!weekKey) {
    throw new ValidationError('weekKey query parameter is required')
  }

  const kpi = await getWeeklyKpi(userId, weekKey)
  return { kpi }
})
