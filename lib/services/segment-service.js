/**
 * セグメントサービス - セグメント操作のビジネスロジック
 */

import { prisma } from '@/lib/prisma'
import { MOCK_USER_ID, STT_STATUS } from '@/lib/constants'
import { NotFoundError, ValidationError } from '@/lib/errors'

/**
 * セグメント一覧を取得
 * @param {Object} options
 * @param {string} options.sessionId - セッションIDでフィルタ（任意）
 * @param {number} options.limit - 取得件数上限
 * @returns {Promise<Array>} セグメント一覧
 */
export async function listSegments({ sessionId, limit = 100 } = {}) {
  const where = { userId: MOCK_USER_ID }
  if (sessionId) where.sessionId = sessionId

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
 * セグメント詳細を取得
 * @param {string} id - セグメントID
 * @returns {Promise<Object>} セグメント詳細
 * @throws {NotFoundError} セグメントが存在しない場合
 */
export async function getSegment(id) {
  const segment = await prisma.segment.findFirst({
    where: { id, userId: MOCK_USER_ID },
    include: {
      bunjin: true,
      session: true,
    },
  })
  if (!segment) throw new NotFoundError('Segment', id)
  return segment
}

/**
 * セグメントのSTTステータスを更新
 * @param {string} id - セグメントID
 * @param {Object} params
 * @param {string} params.sttStatus - STTステータス
 * @param {string} params.text - 文字起こしテキスト
 * @returns {Promise<Object>} 更新されたセグメント
 * @throws {NotFoundError} セグメントが存在しない場合
 * @throws {ValidationError} 不正なSTTステータスの場合
 */
export async function updateSegmentSttStatus(id, { sttStatus, text }) {
  const segment = await prisma.segment.findFirst({ where: { id, userId: MOCK_USER_ID } })
  if (!segment) throw new NotFoundError('Segment', id)

  const validStatuses = Object.values(STT_STATUS)
  if (sttStatus && !validStatuses.includes(sttStatus)) {
    throw new ValidationError(`Invalid STT status: ${sttStatus}`)
  }

  if (text !== undefined && typeof text === 'string' && text.length > 100000) {
    throw new ValidationError('Text exceeds maximum length of 100000 characters')
  }

  const data = {}
  if (sttStatus) data.sttStatus = sttStatus
  if (text !== undefined) data.text = text
  if (sttStatus === STT_STATUS.PROCESSING) {
    data.sttAttemptCount = { increment: 1 }
  }

  return prisma.segment.update({ where: { id }, data })
}
