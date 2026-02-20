/**
 * セグメントサービス - セグメント操作のビジネスロジック
 */

import { prisma } from '@/lib/prisma'
import { STT_STATUS } from '@/lib/constants'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { validateSttTransition } from '@/lib/validators'
import { requireUserId } from './base-service.js'
import { logger } from '@/lib/logger.js'

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

  // 既存セグメントのSTT状態遷移を検証（DONE は最終状態のため上書き不可）
  const existing = await prisma.segment.findUnique({
    where: { sessionId_segmentNo: { sessionId, segmentNo } },
    select: { sttStatus: true },
  })
  if (existing) {
    const transition = validateSttTransition(existing.sttStatus, STT_STATUS.DONE)
    if (!transition.valid) {
      throw new ValidationError(transition.message)
    }
  }

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
/**
 * 音声削除ログを記録（STT完了後の監査証跡）
 * Flutter端末で音声ファイルを削除した後にサーバー側でも証跡を残す
 * @param {string} segmentId - セグメントID
 * @param {string} [reason] - 削除理由（デフォルト: STT_COMPLETED）
 * @returns {Promise<Object>} 作成されたAudioDeletionLog
 */
export async function createAudioDeletionLog(segmentId, reason = 'STT_COMPLETED') {
  if (!segmentId) throw new ValidationError('segmentId is required')

  try {
    return await prisma.audioDeletionLog.create({
      data: {
        segmentId,
        deletedAt: new Date(),
        reason,
      },
    })
  } catch (error) {
    // ユニーク制約違反（既に記録済み）は無視する（冪等）
    if (error?.code === 'P2002') {
      logger.warn('AudioDeletionLog already exists for segment, skipping', {
        component: 'segment-service',
        segmentId,
      })
      return null
    }
    throw error
  }
}

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
