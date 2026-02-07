/**
 * セッションサービス - セッション操作のビジネスロジック
 */

import { prisma } from '@/lib/prisma'
import { MOCK_USER_ID, SESSION_STATUS } from '@/lib/constants'
import { NotFoundError } from '@/lib/errors'

/**
 * 新しいセッションを作成
 * @param {Object} params
 * @param {string} params.deviceId - デバイスID
 * @returns {Promise<Object>} 作成されたセッション
 */
export async function createSession({ deviceId }) {
  // ユーザーの最新公開バージョンを取得
  const latestVersion = await prisma.publishedVersion.findFirst({
    where: { ruleTree: { userId: MOCK_USER_ID } },
    orderBy: { version: 'desc' },
  })

  return prisma.session.create({
    data: {
      userId: MOCK_USER_ID,
      deviceId,
      status: SESSION_STATUS.ACTIVE,
      ruleVersionId: latestVersion?.id || null,
    },
  })
}

/**
 * セッション一覧を取得
 * @param {Object} options
 * @param {number} options.limit - 取得件数上限
 * @returns {Promise<Array>} セッション一覧
 */
export async function listSessions({ limit = 50 } = {}) {
  return prisma.session.findMany({
    where: { userId: MOCK_USER_ID },
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
 * @param {string} id - セッションID
 * @returns {Promise<Object>} セッション詳細
 * @throws {NotFoundError} セッションが存在しない場合
 */
export async function getSession(id) {
  const session = await prisma.session.findUnique({
    where: { id },
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
 * @param {string} id - セッションID
 * @returns {Promise<Object>} 更新されたセッション
 * @throws {NotFoundError} セッションが存在しない場合
 */
export async function stopSession(id) {
  const session = await prisma.session.findUnique({ where: { id } })
  if (!session) throw new NotFoundError('Session', id)

  return prisma.session.update({
    where: { id },
    data: {
      status: SESSION_STATUS.STOPPED,
      endedAt: new Date().toISOString(),
    },
  })
}
