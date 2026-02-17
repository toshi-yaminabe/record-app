/**
 * ローカル文字起こしセグメントサービス
 *
 * ローカルSTT/サーバーSTTの結果テキストを、mode情報付きでセグメントに保存する。
 * 既存の segment-service.js は変更しない。
 */

import { prisma } from '@/lib/prisma'
import { STT_STATUS } from '@/lib/constants'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { requireUserId } from './base-service.js'

/**
 * ローカル文字起こし結果からセグメントを作成（sttStatus = DONE）
 * @param {string} userId - ユーザーID
 * @param {Object} params
 * @param {string} params.sessionId
 * @param {number} params.segmentNo
 * @param {string} params.startAt - ISO 8601
 * @param {string} params.endAt - ISO 8601
 * @param {string} params.text - 文字起こしテキスト
 * @param {string} params.selectedMode - 'SERVER' | 'LOCAL'
 * @param {string} params.executedMode - 'SERVER' | 'LOCAL'
 * @param {string|null} [params.fallbackReason]
 * @param {string|null} [params.localEngineVersion]
 * @returns {Promise<Object>} 作成されたセグメント
 */
export async function createLocalSegment(userId, {
  sessionId,
  segmentNo,
  startAt,
  endAt,
  text,
  selectedMode,
  executedMode,
  fallbackReason,
  localEngineVersion,
}) {
  requireUserId(userId)
  if (!sessionId) throw new ValidationError('sessionId is required')
  if (!text) throw new ValidationError('text is required')

  // セッション所有権チェック
  const session = await prisma.session.findFirst({ where: { id: sessionId, userId } })
  if (!session) throw new NotFoundError('Session', sessionId)

  const data = {
    startAt: new Date(startAt),
    endAt: new Date(endAt),
    text,
    sttStatus: STT_STATUS.DONE,
    selectedMode,
    executedMode,
    fallbackReason: fallbackReason || null,
    localEngineVersion: localEngineVersion || null,
  }

  return prisma.segment.upsert({
    where: {
      sessionId_segmentNo: { sessionId, segmentNo },
    },
    update: data,
    create: {
      sessionId,
      userId,
      segmentNo,
      ...data,
    },
  })
}
