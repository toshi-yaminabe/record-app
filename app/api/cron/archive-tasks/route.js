/**
 * GET /api/cron/archive-tasks - タスク自動アーカイブ（Cron認証）
 */

import { withApi } from '@/lib/middleware.js'
import { archiveStaleTasks } from '@/lib/services/task-service.js'

export const GET = withApi(async () => {
  const result = await archiveStaleTasks()
  return {
    archivedCount: result.count,
    archivedIds: result.archivedIds,
  }
}, { cronMode: true, requireAuth: false })
