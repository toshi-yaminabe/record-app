/**
 * 文字起こしモード定数 + バリデーションスキーマ
 */

import { z } from 'zod'

// STTモード定数
export const TRANSCRIBE_MODE = Object.freeze({
  SERVER: 'SERVER',
  LOCAL: 'LOCAL',
})

// ローカル文字起こし投入スキーマ
export const localTranscribeSchema = z.object({
  sessionId: z.string().min(1),
  segmentNo: z.number().int().min(0),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  text: z.string().min(1),
  selectedMode: z.enum(['SERVER', 'LOCAL']),
  executedMode: z.enum(['SERVER', 'LOCAL']),
  fallbackReason: z.string().nullable().optional(),
  localEngineVersion: z.string().nullable().optional(),
}).refine(
  data => !(data.selectedMode === 'LOCAL' && data.executedMode === 'SERVER' && !data.fallbackReason),
  { message: 'fallbackReason required when LOCAL falls back to SERVER' }
)
