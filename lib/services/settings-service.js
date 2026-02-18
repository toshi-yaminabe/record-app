/**
 * 設定サービス - ユーザー設定・APIキー管理
 */

import { prisma } from '@/lib/prisma.js'
import { encrypt } from '@/lib/crypto.js'
import { requireUserId } from './base-service.js'

/**
 * ユーザー設定を取得
 * APIキーの有無のみ返す（平文キーは返さない）
 * @param {string} userId - ユーザーID
 * @returns {Promise<{ hasGeminiApiKey: boolean, updatedAt: Date|null }>}
 */
export async function getSettings(userId) {
  requireUserId(userId)

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  })

  return {
    hasGeminiApiKey: !!settings?.geminiApiKey,
    updatedAt: settings?.updatedAt ?? null,
  }
}

/**
 * GeminiのAPIキーを暗号化して保存
 * @param {string} userId - ユーザーID
 * @param {string} key - 平文APIキー
 * @returns {Promise<{ hasGeminiApiKey: boolean, updatedAt: Date }>}
 */
export async function updateApiKey(userId, key) {
  requireUserId(userId)

  const encryptedKey = encrypt(key)

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: { geminiApiKey: encryptedKey },
    create: { userId, geminiApiKey: encryptedKey },
  })

  return {
    hasGeminiApiKey: !!settings.geminiApiKey,
    updatedAt: settings.updatedAt,
  }
}

/**
 * GeminiのAPIキーを削除
 * @param {string} userId - ユーザーID
 * @returns {Promise<{ deleted: boolean }>}
 */
export async function deleteApiKey(userId) {
  requireUserId(userId)

  await prisma.userSettings.upsert({
    where: { userId },
    update: { geminiApiKey: null },
    create: { userId },
  })

  return { deleted: true }
}
