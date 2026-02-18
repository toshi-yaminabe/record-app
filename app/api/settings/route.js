/**
 * GET    /api/settings - ユーザー設定取得
 * PUT    /api/settings - ユーザー設定更新（APIキー保存）
 * DELETE /api/settings - APIキー削除
 */

import { withApi } from '@/lib/middleware.js'
import { validateBody, settingsSchema } from '@/lib/validators.js'
import { getSettings, updateApiKey, deleteApiKey } from '@/lib/services/settings-service.js'

export const GET = withApi(async (request, { userId }) => {
  const settings = await getSettings(userId)
  return { settings }
})

export const PUT = withApi(async (request, { userId }) => {
  const body = await request.json()
  const validated = validateBody(settingsSchema, body)
  const { geminiApiKey } = validated

  const settings = await updateApiKey(userId, geminiApiKey)
  return { settings }
})

export const DELETE = withApi(async (request, { userId }) => {
  const result = await deleteApiKey(userId)
  return result
})
