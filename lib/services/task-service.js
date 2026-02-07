/**
 * タスクサービス
 * - タスクのCRUD操作
 * - ステータス遷移検証
 * - 古いタスクの自動アーカイブ
 */

import { prisma } from '@/lib/prisma.js'
import { MOCK_USER_ID, TASK_STATUS, ARCHIVE_AFTER_DAYS } from '@/lib/constants.js'
import { validateTaskTransition } from '@/lib/validators.js'
import { ValidationError, NotFoundError } from '@/lib/errors.js'

// ========================================
// タスク一覧取得
// ========================================

/**
 * タスクを一覧取得
 * @param {{ status?: string, bunjinId?: string, limit?: number }} options
 * @returns {Promise<Array>}
 */
export async function listTasks({ status, bunjinId, limit = 50 } = {}) {
  const where = {
    userId: MOCK_USER_ID,
  }

  // ステータスフィルタ（指定なしの場合はARCHIVED以外）
  if (status) {
    where.status = status
  } else {
    where.status = {
      not: TASK_STATUS.ARCHIVED,
    }
  }

  // 分人フィルタ
  if (bunjinId) {
    where.bunjinId = bunjinId
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
 * @param {{ title: string, body?: string, bunjinId?: string, priority?: number }} data
 * @returns {Promise<Object>}
 * @throws {ValidationError} 必須フィールド不足
 */
export async function createTask(data) {
  const { title, body, bunjinId, priority } = data

  // 必須フィールド検証
  if (!title) {
    throw new ValidationError('title is required')
  }

  // 分人IDの存在確認（指定された場合）
  if (bunjinId) {
    const bunjin = await prisma.bunjin.findUnique({
      where: { id: bunjinId },
    })
    if (!bunjin || bunjin.userId !== MOCK_USER_ID) {
      throw new ValidationError(`Bunjin not found: ${bunjinId}`)
    }
  }

  // タスク作成
  const task = await prisma.task.create({
    data: {
      userId: MOCK_USER_ID,
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
 * - 遷移マトリクスで検証
 * - ARCHIVED移行時に archivedAt を設定
 * - DONE以外への移行時に archivedAt をクリア
 *
 * @param {string} id - タスクID
 * @param {string} newStatus - 新しいステータス
 * @returns {Promise<Object>}
 * @throws {NotFoundError} タスクが存在しない
 * @throws {ValidationError} 無効な状態遷移
 */
export async function updateTaskStatus(id, newStatus) {
  // タスク存在確認
  const task = await prisma.task.findUnique({
    where: { id },
  })

  if (!task || task.userId !== MOCK_USER_ID) {
    throw new NotFoundError('Task', id)
  }

  // ステータス遷移検証
  const validation = validateTaskTransition(task.status, newStatus)
  if (!validation.valid) {
    throw new ValidationError(validation.message)
  }

  // 更新データ準備
  const updateData = {
    status: newStatus,
  }

  // ARCHIVED移行時: archivedAtを設定
  if (newStatus === TASK_STATUS.ARCHIVED) {
    updateData.archivedAt = new Date()
  }

  // DONE以外への移行時: archivedAtをクリア
  if (task.status === TASK_STATUS.DONE && newStatus !== TASK_STATUS.ARCHIVED) {
    updateData.archivedAt = null
  }

  // 更新
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
 * - TODO/DOINGステータスのみ対象
 * - archivedAtを設定してARCHIVEDステータスに変更
 *
 * @returns {Promise<{ count: number, archivedIds: string[] }>}
 */
export async function archiveStaleTasks() {
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - ARCHIVE_AFTER_DAYS)

  // 対象タスクを検索
  const staleTasks = await prisma.task.findMany({
    where: {
      userId: MOCK_USER_ID,
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

  // 一括アーカイブ
  await prisma.task.updateMany({
    where: {
      id: { in: taskIds },
    },
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
