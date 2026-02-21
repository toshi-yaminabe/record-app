/**
 * セッションサービス - セッション操作のビジネスロジック
 */

import { prisma } from '@/lib/prisma.js'
import { SESSION_STATUS } from '@/lib/constants.js'
import { NotFoundError, ValidationError } from '@/lib/errors.js'
import { requireUserId } from './base-service.js'

/**
 * ruleVersionId未設定の既存セッションに最新公開バージョンを補完する
 * @param {Object} session - 既存セッション
 * @param {string} userId - ユーザーID
 * @returns {Promise<Object>} セッション（ruleVersionId補完済み）
 */
async function backfillRuleVersion(session, userId) {
  if (session.ruleVersionId) return session

  const latestVersion = await prisma.publishedVersion.findFirst({
    where: { ruleTree: { userId } },
    orderBy: { version: 'desc' },
  })

  if (!latestVersion) return session

  return prisma.session.update({
    where: { id: session.id },
    data: { ruleVersionId: latestVersion.id },
  })
}

/**
 * 新しいセッションを作成
 * @param {string} userId - ユーザーID
 * @param {Object} params
 * @param {string} params.deviceId - デバイスID
 * @returns {Promise<Object>} 作成されたセッション
 */
export async function createSession(userId, { deviceId }) {
  requireUserId(userId)

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
 * アクティブセッションを検索または新規作成
 *
 * Flutter側が指定した clientSessionId がある場合はそれを優先検索し、
 * 見つからなければ deviceId で既存ACTIVEセッションを検索、
 * それもなければ新規作成する。
 *
 * @param {string} userId - ユーザーID
 * @param {Object} params
 * @param {string} params.deviceId - デバイスID
 * @param {string} [params.clientSessionId] - Flutter側が指定したセッションID
 * @returns {Promise<Object>} 既存または新規セッション
 */
export async function findOrCreateSession(userId, { deviceId, clientSessionId }) {
  requireUserId(userId)

  // 1. クライアント指定IDで検索（Flutter UUID → DB session.id の整合性）
  // ACTIVEセッションのみ返却し、STOPPEDセッションへの追記を防止
  if (clientSessionId) {
    const byClientId = await prisma.session.findFirst({
      where: { id: clientSessionId, userId, status: SESSION_STATUS.ACTIVE },
    })
    if (byClientId) return backfillRuleVersion(byClientId, userId)
  }

  // 2. deviceIdで既存ACTIVEセッションを検索
  const existing = await prisma.session.findFirst({
    where: { deviceId, userId, status: SESSION_STATUS.ACTIVE },
    orderBy: { startedAt: 'desc' },
  })

  if (existing) return backfillRuleVersion(existing, userId)

  return createSession(userId, { deviceId })
}

/**
 * セッション一覧を取得
 * @param {string} userId - ユーザーID
 * @param {Object} options
 * @param {number} options.limit - 取得件数上限
 * @returns {Promise<Array>} セッション一覧
 */
export async function listSessions(userId, { limit = 50 } = {}) {
  requireUserId(userId)

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
  requireUserId(userId)

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
  requireUserId(userId)

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
