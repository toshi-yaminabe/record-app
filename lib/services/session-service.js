/**
 * セッションサービス - セッション操作のビジネスロジック
 */

import { prisma } from '@/lib/prisma'
import { SESSION_STATUS } from '@/lib/constants'
import { NotFoundError, ValidationError } from '@/lib/errors'

/**
 * 新しいセッションを作成
 * @param {string} userId - ユーザーID
 * @param {Object} params
 * @param {string} params.deviceId - デバイスID
 * @returns {Promise<Object>} 作成されたセッション
 */
export async function createSession(userId, { deviceId }) {
  if (!userId) throw new ValidationError('userId is required')

  const latestVersion = await prisma.publishedVersion.findFirst({
    where: { ruleTree: { userId } },
    orderBy: { version: 'desc' },
  })

  return prisma.session.create({
    data: {
      userId,
      deviceId,
      status: SESSION_STATUS.ACTIVE,
      ruleVersionId: latestVersion?.id || null,
    },
  })
}

/**
 * セッション一覧を取得
 * @param {string} userId - ユーザーID
 * @param {Object} options
 * @param {number} options.limit - 取得件数上限
 * @returns {Promise<Array>} セッション一覧
 */
export async function listSessions(userId, { limit = 50 } = {}) {
  if (!userId) throw new ValidationError('userId is required')

  return prisma.session.findMany({
    where: { userId },
    orderBy: { startedAt: 'desc' },
    take: limit,
    include: {
      _count: {
        select: { segments: true },
      },
    },
  })
}

/**
 * セッション詳細を取得
 * @param {string} userId - ユーザーID
 * @param {string} id - セッションID
 * @returns {Promise<Object>} セッション詳細
 */
export async function getSession(userId, id) {
  if (!userId) throw new ValidationError('userId is required')

  const session = await prisma.session.findFirst({
    where: { id, userId },
    include: {
      segments: {
        orderBy: { segmentNo: 'asc' },
      },
      ruleVersion: true,
    },
  })
  if (!session) throw new NotFoundError('Session', id)
  return session
}

/**
 * セッションを停止
 * @param {string} userId - ユーザーID
 * @param {string} id - セッションID
 * @returns {Promise<Object>} 更新されたセッション
 */
export async function stopSession(userId, id) {
  if (!userId) throw new ValidationError('userId is required')

  const session = await prisma.session.findFirst({ where: { id, userId } })
  if (!session) throw new NotFoundError('Session', id)

  return prisma.session.update({
    where: { id },
    data: {
      status: SESSION_STATUS.STOPPED,
      endedAt: new Date(),
    },
  })
}
