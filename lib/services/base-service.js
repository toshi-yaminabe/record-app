/**
 * サービス共通ヘルパー
 */

import { ValidationError, NotFoundError } from '@/lib/errors.js'
import { prisma } from '@/lib/prisma.js'

/**
 * userIdの存在を検証
 * @param {string} userId
 * @throws {ValidationError}
 */
export function requireUserId(userId) {
  if (!userId) throw new ValidationError('userId is required')
}

/**
 * 所有権チェック付きレコード取得
 * @param {Object} model - Prismaモデル (e.g., prisma.bunjin)
 * @param {string} id - レコードID
 * @param {string} userId - 所有者ID
 * @param {string} entityName - エンティティ名 (エラーメッセージ用)
 * @returns {Promise<Object>} 取得したレコード
 * @throws {NotFoundError}
 */
export async function findOwnedOrThrow(model, id, userId, entityName) {
  const record = await model.findUnique({ where: { id } })
  if (!record || record.userId !== userId) {
    throw new NotFoundError(entityName, id)
  }
  return record
}
