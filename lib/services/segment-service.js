/**
 * セグメントサービス - セグメント操作のビジネスロジック
 */

import { prisma } from '@/lib/prisma'
import { STT_STATUS } from '@/lib/constants'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { validateSttTransition } from '@/lib/validators'
import { requireUserId } from './base-service.js'

/**
 * セグメント一覧を取得
 * @param {string} userId - ユーザーID
 * @param {Object} options
 * @param {string} options.sessionId - セッションIDでフィルタ（任意）
 * @param {number} options.limit - 取得件数上限
 * @returns {Promise<Array>} セグメント一覧
 */
export async function listSegments(userId, { sessionId, limit = 100 } = {}) {
  requireUserId(userId)

  const where = {
    userId,
    ...(sessionId && { sessionId }),
  }

  return prisma.segment.findMany({
    where,
    orderBy: [{ sessionId: 'desc' }, { segmentNo: 'asc' }],
    take: limit,
    include: {
      bunjin: true,
    },
  })
}

/**
 * セグメントを作成（PENDINGステータス）
 * @param {string} userId - ユーザーID
 * @param {Object} params
 * @param {string} params.sessionId - セッションID
 * @param {number} params.segmentNo - セグメント番号
 * @param {string} params.startAt - 開始時刻 (ISO 8601)
 * @param {string} params.endAt - 終了時刻 (ISO 8601)
 * @param {string} [params.storageObjectPath] - Storageパス
 * @returns {Promise<Object>} 作成されたセグメント
 */
export async function createSegment(userId, { sessionId, segmentNo, startAt, endAt, storageObjectPath }) {
  requireUserId(userId)
  if (!sessionId) throw new ValidationError('sessionId is required')
  if (segmentNo === undefined || segmentNo === null) throw new ValidationError('segmentNo is required')

  // セッション所有権チェック
  const session = await prisma.session.findFirst({ where: { id: sessionId, userId } })
  if (!session) throw new NotFoundError('Session', sessionId)

  return prisma.segment.upsert({
    where: {
      sessionId_segmentNo: { sessionId, segmentNo },
    },
    update: {
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      storageObjectPath: storageObjectPath || null,
    },
    create: {
      sessionId,
      userId,
      segmentNo,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      sttStatus: STT_STATUS.PENDING,
      storageObjectPath: storageObjectPath || null,
    },
  })
}

/**
 * セグメント詳細を取得
 * @param {string} userId - ユーザーID
 * @param {string} id - セグメントID
 * @returns {Promise<Object>} セグメント詳細
 */
export async function getSegment(userId, id) {
  requireUserId(userId)

  const segment = await prisma.segment.findFirst({
    where: { id, userId },
    include: {
      bunjin: true,
      session: true,
    },
  })
  if (!segment) throw new NotFoundError('Segment', id)
  return segment
}

/**
 * セグメントの作成または更新（文字起こし結果付き）
 * transcribeルート向けのupsertラッパー
 * @param {string} userId - ユーザーID
 * @param {Object} params
 * @param {string} params.sessionId - セッションID
 * @param {number} params.segmentNo - セグメント番号
 * @param {string} params.text - 文字起こしテキスト
 * @param {string} [params.startAt] - 開始時刻 (ISO 8601)
 * @param {string} [params.endAt] - 終了時刻 (ISO 8601)
 * @returns {Promise<Object>} 作成または更新されたセグメント
 */
export async function createOrUpdateSegment(userId, { sessionId, segmentNo, text, startAt, endAt }) {
  requireUserId(userId)
  if (!sessionId) throw new ValidationError('sessionId is required')
  if (segmentNo === undefined || segmentNo === null) throw new ValidationError('segmentNo is required')
  if (!text) throw new ValidationError('text is required')

  const now = new Date()
  return prisma.segment.upsert({
    where: {
      sessionId_segmentNo: { sessionId, segmentNo },
    },
    update: {
      text,
      startAt: startAt ? new Date(startAt) : now,
      endAt: endAt ? new Date(endAt) : now,
      sttStatus: STT_STATUS.DONE,
    },
    create: {
      sessionId,
      userId,
      segmentNo,
      startAt: startAt ? new Date(startAt) : now,
      endAt: endAt ? new Date(endAt) : now,
      text,
      sttStatus: STT_STATUS.DONE,
    },
  })
}

/**
 * セグメントのSTTステータスを更新
 * @param {string} userId - ユーザーID
 * @param {string} id - セグメントID
 * @param {Object} params
 * @param {string} params.sttStatus - STTステータス
 * @param {string} params.text - 文字起こしテキスト
 * @returns {Promise<Object>} 更新されたセグメント
 */
export async function updateSegmentSttStatus(userId, id, { sttStatus, text }) {
  requireUserId(userId)

  const segment = await prisma.segment.findFirst({ where: { id, userId } })
  if (!segment) throw new NotFoundError('Segment', id)

  const validStatuses = Object.values(STT_STATUS)
  if (sttStatus && !validStatuses.includes(sttStatus)) {
    throw new ValidationError(`Invalid STT status: ${sttStatus}`)
  }

  if (sttStatus) {
    const transition = validateSttTransition(segment.sttStatus, sttStatus)
    if (!transition.valid) {
      throw new ValidationError(transition.message)
    }
  }

  if (text !== undefined && typeof text === 'string' && text.length > 100000) {
    throw new ValidationError('Text exceeds maximum length of 100000 characters')
  }

  const data = {
    ...(sttStatus && { sttStatus }),
    ...(text !== undefined && { text }),
    ...(sttStatus === STT_STATUS.PROCESSING && sttStatus !== segment.sttStatus && { sttAttemptCount: { increment: 1 } }),
  }

  return prisma.segment.update({ where: { id }, data })
}
