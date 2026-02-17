/**
 * SWLS Service - 主観的幸福度管理
 */

import { prisma } from '@/lib/prisma.js'
import { ValidationError } from '@/lib/errors.js'
import { isValidDateKey } from '@/lib/validators.js'
import { requireUserId } from './base-service.js'

/**
 * 指定日のSWLS回答を取得
 * @param {string} userId - ユーザーID
 * @param {string} dateKey - 日付キー (YYYY-MM-DD)
 * @returns {Promise<Object|null>}
 */
export async function getSwlsResponse(userId, dateKey) {
  requireUserId(userId)

  if (!isValidDateKey(dateKey)) {
    throw new ValidationError(`Invalid dateKey format: ${dateKey}`)
  }

  return await prisma.swlsResponse.findUnique({
    where: {
      userId_dateKey: { userId, dateKey },
    },
  })
}

/**
 * SWLS回答をupsert（作成または更新）
 * @param {string} userId - ユーザーID
 * @param {Object} data
 * @param {string} data.dateKey
 * @param {string} [data.q1] - [data.q5]
 * @returns {Promise<Object>}
 */
export async function upsertSwlsResponse(userId, { dateKey, q1, q2, q3, q4, q5 }) {
  requireUserId(userId)

  if (!isValidDateKey(dateKey)) {
    throw new ValidationError(`Invalid dateKey format: ${dateKey}`)
  }

  const answers = { q1, q2, q3, q4, q5 }
  for (const [key, val] of Object.entries(answers)) {
    if (val !== undefined && (typeof val !== 'string' || val.length > 500)) {
      throw new ValidationError(`${key} must be a string of max 500 characters`)
    }
  }

  const updateData = {}
  if (q1 !== undefined) updateData.q1 = q1
  if (q2 !== undefined) updateData.q2 = q2
  if (q3 !== undefined) updateData.q3 = q3
  if (q4 !== undefined) updateData.q4 = q4
  if (q5 !== undefined) updateData.q5 = q5

  return await prisma.swlsResponse.upsert({
    where: {
      userId_dateKey: { userId, dateKey },
    },
    create: {
      userId,
      dateKey,
      ...updateData,
    },
    update: updateData,
  })
}
