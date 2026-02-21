/**
 * 文字起こしサービス - 音声STTのビジネスロジック
 */

import { transcribeAudio } from '@/lib/gemini.js'
import { AppError } from '@/lib/errors.js'
import { findOrCreateSession } from '@/lib/services/session-service.js'
import { createOrUpdateSegment, createAudioDeletionLog } from '@/lib/services/segment-service.js'
import { evaluateAndAssignBunjin } from '@/lib/services/rule-evaluator-service.js'
import { requireUserId } from './base-service.js'
import { logger } from '@/lib/logger.js'

// ========================================
// Geminiエラー分類
// ========================================

/**
 * Gemini APIエラーをHTTPステータスコード付きの AppError に変換する
 * @param {Error} error - Gemini呼び出し中に発生したエラー
 * @returns {AppError} 分類済みの AppError
 */
function classifyGeminiError(error) {
  const msg = error.message ?? ''

  if (msg.includes('timeout')) {
    return new AppError('Gemini API request timeout. Please try again.', 504)
  }

  if (msg.includes('quota') || msg.includes('rate limit')) {
    return new AppError('Gemini API rate limit exceeded. Please wait and try again.', 502)
  }

  if (msg.includes('GEMINI_API_KEY') || msg.includes('API')) {
    return new AppError('Gemini API error. Please check configuration.', 502)
  }

  return error
}

// ========================================
// メインサービス関数
// ========================================

/**
 * 音声セグメントを文字起こしし、DBに保存する
 *
 * @param {string} userId - 認証済みユーザーID
 * @param {Object} params
 * @param {Buffer}  params.audioBuffer  - 音声データのバイナリバッファ
 * @param {string}  params.mimeType     - 音声MIMEタイプ (例: "audio/mp4")
 * @param {string}  params.sessionId    - フロントエンドが指定したセッションID (findOrCreate に使用)
 * @param {number}  params.segmentNo    - セグメント番号
 * @param {string}  [params.startAt]   - セグメント開始時刻 (ISO 8601)
 * @param {string}  [params.endAt]     - セグメント終了時刻 (ISO 8601)
 * @param {string}  params.deviceId    - デバイスID (セッション特定に使用)
 * @returns {Promise<{ segment: Object, sessionId: string, text: string }>}
 */
export async function transcribeSegment(userId, { audioBuffer, mimeType, sessionId, segmentNo, startAt, endAt, deviceId }) {
  requireUserId(userId)

  // Gemini STT 呼び出し（エラーを分類して再スロー）
  let text
  try {
    text = await transcribeAudio(audioBuffer, mimeType, userId)
  } catch (error) {
    throw classifyGeminiError(error)
  }

  // セッション取得または新規作成（Flutter指定sessionIdを優先検索）
  const session = await findOrCreateSession(userId, { deviceId, clientSessionId: sessionId })

  // セグメントをupsert（文字起こし結果付き）
  const segment = await createOrUpdateSegment(userId, {
    sessionId: session.id,
    segmentNo,
    text,
    startAt,
    endAt,
  })

  // STT完了後にルールツリーを評価し、bunjinIdを自動割当（E2: 分人別に整理される）
  try {
    await evaluateAndAssignBunjin(userId, segment)
  } catch (evalError) {
    // ルール評価失敗はSTT結果に影響させない（best-effort）
    logger.warn('Failed to evaluate rule tree for bunjin assignment', {
      component: 'transcribe-service',
      segmentId: segment.id,
      error: evalError.message,
    })
  }

  // STT完了後の音声削除ログを記録（監査証跡）
  // Flutter端末での音声ファイル削除を促進し、プライバシーを保護する
  try {
    await createAudioDeletionLog(segment.id, 'STT_COMPLETED')
  } catch (logError) {
    // ログ記録失敗はSTT結果に影響させない（best-effort）
    logger.warn('Failed to create AudioDeletionLog', {
      component: 'transcribe-service',
      segmentId: segment.id,
      error: logError.message,
    })
  }

  return { segment, sessionId: session.id, text }
}
