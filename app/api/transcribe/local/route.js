/**
 * POST /api/transcribe/local - ローカル文字起こし結果をテキストで投入
 *
 * Flutter端末がローカルSTT(またはサーバーSTT)の結果テキストを
 * mode情報付きでサーバーDBに同期するためのエンドポイント。
 * 音声ファイルは送信されない。
 */

import { withApi } from '@/lib/middleware.js'
import { createLocalSegment } from '@/lib/services/local-segment-service.js'
import { validateBody } from '@/lib/validators.js'
import { localTranscribeSchema } from '@/lib/transcribe-mode.js'

export const POST = withApi(async (request, { userId }) => {
  const body = await request.json()
  const validated = validateBody(localTranscribeSchema, body)

  const segment = await createLocalSegment(userId, {
    sessionId: validated.sessionId,
    segmentNo: validated.segmentNo,
    startAt: validated.startAt,
    endAt: validated.endAt,
    text: validated.text,
    selectedMode: validated.selectedMode,
    executedMode: validated.executedMode,
    fallbackReason: validated.fallbackReason,
    localEngineVersion: validated.localEngineVersion,
  })

  return {
    segmentId: segment.id,
    sttStatus: segment.sttStatus,
  }
})
