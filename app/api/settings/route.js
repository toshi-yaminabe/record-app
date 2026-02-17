/**
 * GET    /api/settings - ユーザー設定取得
 * PUT    /api/settings - ユーザー設定更新
 * DELETE /api/settings - APIキー削除
 */

import { withApi } from '@/lib/middleware.js'
import { prisma } from '@/lib/prisma.js'
import { encrypt } from '@/lib/crypto.js'
import { ValidationError } from '@/lib/errors.js'
import { validateBody, settingsSchema } from '@/lib/validators.js'

export const GET = withApi(async (request, { userId }) => {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  })

  return {
    settings: {
      hasGeminiApiKey: !!settings?.geminiApiKey,
      updatedAt: settings?.updatedAt ?? null,
    },
  }
})

export const PUT = withApi(async (request, { userId }) => {
  const body = await request.json()
  const validated = validateBody(settingsSchema, body)
  const { geminiApiKey } = validated

  if (geminiApiKey !== undefined && geminiApiKey !== null) {
    if (typeof geminiApiKey !== 'string') {
      throw new ValidationError('geminiApiKey must be a string')
    }
    if (geminiApiKey.length > 0 && geminiApiKey.length < 10) {
      throw new ValidationError('Invalid API key format')
    }
  }

  const encryptedKey = geminiApiKey ? encrypt(geminiApiKey) : null

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: { geminiApiKey: encryptedKey },
    create: { userId, geminiApiKey: encryptedKey },
  })

  return {
    settings: {
      hasGeminiApiKey: !!settings.geminiApiKey,
      updatedAt: settings.updatedAt,
    },
  }
})

export const DELETE = withApi(async (request, { userId }) => {
  await prisma.userSettings.upsert({
    where: { userId },
    update: { geminiApiKey: null },
    create: { userId },
  })

  return { deleted: true }
})
