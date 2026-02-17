/**
 * PATCH /api/tasks/[id] - タスクステータス更新
 */

import { withApi } from '@/lib/middleware.js'
import { updateTaskStatus } from '@/lib/services/task-service.js'
import { ValidationError } from '@/lib/errors.js'
import { validateBody, taskUpdateSchema } from '@/lib/validators.js'

export const PATCH = withApi(async (request, { userId, params }) => {
  const { id } = params
  const body = await request.json()
  const validated = validateBody(taskUpdateSchema, body)

  if (!validated.status) {
    throw new ValidationError('status is required')
  }

  const task = await updateTaskStatus(userId, id, validated.status)
  return { task }
})
