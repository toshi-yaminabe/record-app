/**
 * Memory Service - メモリー管理
 */

import { prisma } from '@/lib/prisma.js'
import { MOCK_USER_ID } from '@/lib/constants.js'
import { NotFoundError } from '@/lib/errors.js'

/**
 * メモリー一覧を取得（新しい順）
 * @param {Object} options
 * @param {number} options.limit - 取得件数（デフォルト: 50）
 * @returns {Promise<Array>}
 */
export async function listMemories({ limit = 50 } = {}) {
  return await prisma.memory.findMany({
    where: { userId: MOCK_USER_ID },
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
 * @param {Object} data
 * @param {string} data.text - メモリーテキスト
 * @param {string} [data.bunjinId] - 関連する分人ID
 * @param {string} [data.sourceRefs] - ソース参照（JSON文字列、デフォルト: "[]"）
 * @returns {Promise<Object>}
 */
export async function createMemory({ text, bunjinId, sourceRefs = '[]' }) {
  return await prisma.memory.create({
    data: {
      userId: MOCK_USER_ID,
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
 * @param {string} id - メモリーID
 * @param {string} text - 新しいテキスト
 * @returns {Promise<Object>}
 */
export async function updateMemoryText(id, text) {
  // 存在確認
  const existing = await prisma.memory.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new NotFoundError('Memory', id)
  }

  if (existing.userId !== MOCK_USER_ID) {
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
