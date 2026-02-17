/**
 * GET /api/kpi/daily - 日次KPI取得
 *
 * Query: ?dateKey=YYYY-MM-DD (未指定時は今日)
 */

import { withApi } from '@/lib/middleware.js'
import { getDailyKpi } from '@/lib/services/kpi-service.js'
import { getTodayDateKey } from '@/lib/validators.js'

export const GET = withApi(async (request, { userId }) => {
  const { searchParams } = new URL(request.url)
  const dateKey = searchParams.get('dateKey') || getTodayDateKey()

  const kpi = await getDailyKpi(userId, dateKey)
  return { kpi }
})
