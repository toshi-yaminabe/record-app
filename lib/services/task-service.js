/**
 * タスクサービス
 * - タスクのCRUD操作
 * - ステータス遷移検証
 * - 古いタスクの自動アーカイブ
 */

import { prisma } from '@/lib/prisma.js'
import { TASK_STATUS, ARCHIVE_AFTER_DAYS } from '@/lib/constants.js'
import { validateTaskTransition } from '@/lib/validators.js'
import { ValidationError, NotFoundError } from '@/lib/errors.js'
import { requireUserId, findOwnedOrThrow } from './base-service.js'

// ========================================
// タスク一覧取得
// ========================================

/**
 * タスクを一覧取得
 * @param {string} userId - ユーザーID
 * @param {{ status?: string, bunjinId?: string, limit?: number }} options
 * @returns {Promise<Array>}
 */
export async function listTasks(userId, { status, bunjinId, limit = 50 } = {}) {
  requireUserId(userId)

  const where = {
    userId,
    status: status ? status : { not: TASK_STATUS.ARCHIVED },
    ...(bunjinId && { bunjinId }),
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
    include: {
      bunjin: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          color: true,
          icon: true,
        },
      },
    },
  })

  return tasks
}

// ========================================
// タスク作成
// ========================================

/**
 * 新規タスクを作成
 * @param {string} userId - ユーザーID
 * @param {{ title: string, body?: string, bunjinId?: string, priority?: number }} data
 * @returns {Promise<Object>}
 */
export async function createTask(userId, data) {
  requireUserId(userId)

  const { title, body, bunjinId, priority } = data

  if (!title) {
    throw new ValidationError('title is required')
  }
  if (typeof title !== 'string' || title.length > 500) {
    throw new ValidationError('title must be a string of max 500 characters')
  }
  if (priority !== undefined && (typeof priority !== 'number' || !Number.isFinite(priority) || priority < 0 || priority > 100)) {
    throw new ValidationError('priority must be a number between 0 and 100')
  }

  if (bunjinId) {
    const bunjin = await prisma.bunjin.findUnique({ where: { id: bunjinId } })
    if (!bunjin || bunjin.userId !== userId) {
      throw new ValidationError(`Bunjin not found: ${bunjinId}`)
    }
  }

  const task = await prisma.task.create({
    data: {
      userId,
      title,
      body: body ?? '',
      bunjinId: bunjinId ?? null,
      priority: priority ?? 0,
      status: TASK_STATUS.TODO,
    },
    include: {
      bunjin: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          color: true,
          icon: true,
        },
      },
    },
  })

  return task
}

// ========================================
// タスクステータス更新
// ========================================

/**
 * タスクのステータスを更新
 * @param {string} userId - ユーザーID
 * @param {string} id - タスクID
 * @param {string} newStatus - 新しいステータス
 * @returns {Promise<Object>}
 */
export async function updateTaskStatus(userId, id, newStatus) {
  requireUserId(userId)

  const task = await findOwnedOrThrow(prisma.task, id, userId, 'Task')

  const validation = validateTaskTransition(task.status, newStatus)
  if (!validation.valid) {
    throw new ValidationError(validation.message)
  }

  const updateData = {
    status: newStatus,
    ...(newStatus === TASK_STATUS.ARCHIVED && { archivedAt: new Date() }),
    ...(task.status === TASK_STATUS.DONE && newStatus !== TASK_STATUS.ARCHIVED && { archivedAt: null }),
  }

  const updated = await prisma.task.update({
    where: { id },
    data: updateData,
    include: {
      bunjin: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          color: true,
          icon: true,
        },
      },
    },
  })

  return updated
}

// ========================================
// 古いタスクのアーカイブ
// ========================================

/**
 * 古いタスク（14日以上更新なし）を自動アーカイブ
 * - 全ユーザー対象（Cronジョブ用）
 *
 * @returns {Promise<{ count: number, archivedIds: string[] }>}
 */
export async function archiveStaleTasks() {
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - ARCHIVE_AFTER_DAYS)

  const staleTasks = await prisma.task.findMany({
    where: {
      status: {
        in: [TASK_STATUS.TODO, TASK_STATUS.DOING],
      },
      updatedAt: {
        lt: threshold,
      },
    },
    select: { id: true },
  })

  if (staleTasks.length === 0) {
    return { count: 0, archivedIds: [] }
  }

  const taskIds = staleTasks.map((t) => t.id)

  await prisma.task.updateMany({
    where: { id: { in: taskIds } },
    data: {
      status: TASK_STATUS.ARCHIVED,
      archivedAt: new Date(),
    },
  })

  return {
    count: taskIds.length,
    archivedIds: taskIds,
  }
}
