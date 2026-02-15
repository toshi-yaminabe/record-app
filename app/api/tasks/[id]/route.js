/**
 * PATCH /api/tasks/[id] - タスクステータス更新
 */

import { withApi } from '@/lib/middleware.js'
import { updateTaskStatus } from '@/lib/services/task-service.js'
import { ValidationError } from '@/lib/errors.js'

export const PATCH = withApi(async (request, { userId, params }) => {
  const { id } = params
  const body = await request.json()
  const { status } = body

  if (!status) {
    throw new ValidationError('status is required')
  }

  const task = await updateTaskStatus(userId, id, status)
  return { task }
})
