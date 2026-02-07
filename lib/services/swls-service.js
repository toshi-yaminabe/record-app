/**
 * SWLS Service - 主観的幸福度管理
 */

import { prisma } from '@/lib/prisma.js'
import { MOCK_USER_ID } from '@/lib/constants.js'
import { ValidationError } from '@/lib/errors.js'
import { isValidDateKey } from '@/lib/validators.js'

/**
 * 指定日のSWLS回答を取得
 * @param {string} dateKey - 日付キー (YYYY-MM-DD)
 * @returns {Promise<Object|null>}
 */
export async function getSwlsResponse(dateKey) {
  if (!isValidDateKey(dateKey)) {
    throw new ValidationError(`Invalid dateKey format: ${dateKey}`)
  }

  return await prisma.swlsResponse.findUnique({
    where: {
      userId_dateKey: {
        userId: MOCK_USER_ID,
        dateKey,
      },
    },
  })
}

/**
 * SWLS回答をupsert（作成または更新）
 * @param {Object} data
 * @param {string} data.dateKey - 日付キー (YYYY-MM-DD)
 * @param {string} [data.q1] - 質問1の回答
 * @param {string} [data.q2] - 質問2の回答
 * @param {string} [data.q3] - 質問3の回答
 * @param {string} [data.q4] - 質問4の回答
 * @param {string} [data.q5] - 質問5の回答
 * @returns {Promise<Object>}
 */
export async function upsertSwlsResponse({ dateKey, q1, q2, q3, q4, q5 }) {
  if (!isValidDateKey(dateKey)) {
    throw new ValidationError(`Invalid dateKey format: ${dateKey}`)
  }

  const updateData = {}
  if (q1 !== undefined) updateData.q1 = q1
  if (q2 !== undefined) updateData.q2 = q2
  if (q3 !== undefined) updateData.q3 = q3
  if (q4 !== undefined) updateData.q4 = q4
  if (q5 !== undefined) updateData.q5 = q5

  return await prisma.swlsResponse.upsert({
    where: {
      userId_dateKey: {
        userId: MOCK_USER_ID,
        dateKey,
      },
    },
    create: {
      userId: MOCK_USER_ID,
      dateKey,
      ...updateData,
    },
    update: updateData,
  })
}
