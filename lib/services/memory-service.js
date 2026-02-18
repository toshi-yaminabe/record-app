/**
 * Memory Service - メモリー管理
 */

import { prisma } from '@/lib/prisma.js'
import { NotFoundError, ValidationError } from '@/lib/errors.js'
import { requireUserId, findOwnedOrThrow } from './base-service.js'
import { logger } from '@/lib/logger.js'

/**
 * メモリー一覧を取得（新しい順）
 * @param {string} userId - ユーザーID
 * @param {Object} options
 * @param {number} options.limit - 取得件数（デフォルト: 50）
 * @returns {Promise<Array>}
 */
export async function listMemories(userId, { limit = 50 } = {}) {
  requireUserId(userId)

  return await prisma.memory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      bunjin: {
        select: {
          id: true,
          slug: true,
          displayName: true,
        },
      },
    },
  })
}

/**
 * 新規メモリーを作成
 * @param {string} userId - ユーザーID
 * @param {Object} data
 * @param {string} data.text - メモリーテキスト
 * @param {string} [data.bunjinId] - 関連する分人ID
 * @param {string} [data.sourceRefs] - ソース参照（JSON文字列）
 * @returns {Promise<Object>}
 */
export async function createMemory(userId, { text, bunjinId, sourceRefs = '[]' }) {
  requireUserId(userId)

  return await prisma.memory.create({
    data: {
      userId,
      text,
      bunjinId: bunjinId || null,
      sourceRefs,
    },
    include: {
      bunjin: {
        select: {
          id: true,
          slug: true,
          displayName: true,
        },
      },
    },
  })
}

/**
 * メモリー1件を取得
 * @param {string} userId - ユーザーID
 * @param {string} id - メモリーID
 * @returns {Promise<Object>}
 */
export async function getMemory(userId, id) {
  requireUserId(userId)
  return await findOwnedOrThrow(prisma.memory, id, userId, 'Memory')
}

/**
 * メモリーのテキストを更新
 * @deprecated PATCH /api/memories/[id] は廃止済み。この関数は将来のバージョンで削除予定。
 * @param {string} userId - ユーザーID
 * @param {string} id - メモリーID
 * @param {string} text - 新しいテキスト
 * @returns {Promise<Object>}
 */
export async function updateMemoryText(userId, id, text) {
  logger.warn('updateMemoryText is deprecated and will be removed in a future version', {
    component: 'memory-service',
    userId,
    memoryId: id,
  })
  requireUserId(userId)

  await findOwnedOrThrow(prisma.memory, id, userId, 'Memory')

  return await prisma.memory.update({
    where: { id },
    data: { text },
    include: {
      bunjin: {
        select: {
          id: true,
          slug: true,
          displayName: true,
        },
      },
    },
  })
}
