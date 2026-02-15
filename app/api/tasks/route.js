/**
 * GET  /api/tasks - タスク一覧取得
 * POST /api/tasks - タスク作成
 */

import { withApi } from '@/lib/middleware.js'
import { listTasks, createTask } from '@/lib/services/task-service.js'

export const GET = withApi(async (request, { userId }) => {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const bunjinId = searchParams.get('bunjinId')
  const limit = searchParams.get('limit')

  const rawLimit = limit ? parseInt(limit, 10) : 50
  const safeLimit = (Number.isFinite(rawLimit) && rawLimit >= 1) ? Math.min(rawLimit, 200) : 50

  const tasks = await listTasks(userId, {
    status: status || undefined,
    bunjinId: bunjinId || undefined,
    limit: safeLimit,
  })
  return { tasks }
})

export const POST = withApi(async (request, { userId }) => {
  const body = await request.json()
  const task = await createTask(userId, body)
  return { task }
})
