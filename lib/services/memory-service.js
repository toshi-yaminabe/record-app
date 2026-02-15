/**
 * Memory Service - メモリー管理
 */

import { prisma } from '@/lib/prisma.js'
import { NotFoundError, ValidationError } from '@/lib/errors.js'

/**
 * メモリー一覧を取得（新しい順）
 * @param {string} userId - ユーザーID
 * @param {Object} options
 * @param {number} options.limit - 取得件数（デフォルト: 50）
 * @returns {Promise<Array>}
 */
export async function listMemories(userId, { limit = 50 } = {}) {
  if (!userId) throw new ValidationError('userId is required')

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
  if (!userId) throw new ValidationError('userId is required')

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
 * メモリーのテキストを更新
 * @param {string} userId - ユーザーID
 * @param {string} id - メモリーID
 * @param {string} text - 新しいテキスト
 * @returns {Promise<Object>}
 */
export async function updateMemoryText(userId, id, text) {
  if (!userId) throw new ValidationError('userId is required')

  const existing = await prisma.memory.findUnique({ where: { id } })

  if (!existing || existing.userId !== userId) {
    throw new NotFoundError('Memory', id)
  }

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
