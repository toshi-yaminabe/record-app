/**
 * KPIサービス - STTモード別の集計
 */

import { prisma } from '@/lib/prisma'
import { ValidationError } from '@/lib/errors'
import { requireUserId } from './base-service.js'
import { isValidDateKey, isValidWeekKey } from '@/lib/validators.js'

/**
 * 日付キーからUTC日の開始・終了を取得
 * @param {string} dateKey - "YYYY-MM-DD"
 * @returns {{ start: Date, end: Date }}
 */
function dateKeyToRange(dateKey) {
  const start = new Date(dateKey + 'T00:00:00Z')
  const end = new Date(dateKey + 'T23:59:59.999Z')
  return { start, end }
}

/**
 * 週キーからISO週の開始・終了を取得
 * @param {string} weekKey - "YYYY-Wxx"
 * @returns {{ start: Date, end: Date }}
 */
function weekKeyToRange(weekKey) {
  const [yearStr, weekStr] = weekKey.split('-W')
  const year = parseInt(yearStr, 10)
  const week = parseInt(weekStr, 10)

  // ISO 8601: 週1 = 1月4日を含む週
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayOfWeek = jan4.getUTCDay() || 7 // 日曜=7
  const mondayOfWeek1 = new Date(jan4)
  mondayOfWeek1.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1)

  const start = new Date(mondayOfWeek1)
  start.setUTCDate(mondayOfWeek1.getUTCDate() + (week - 1) * 7)

  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  end.setUTCHours(23, 59, 59, 999)

  return { start, end }
}

/**
 * groupBy結果からmode別カウントを集計
 * @param {Array} groups - Prisma groupBy結果
 * @returns {{ server: number, local: number }}
 */
function aggregateModeGroups(groups) {
  let server = 0
  let local = 0
  for (const g of groups) {
    const count = g._count?.id || 0
    if (g.selectedMode === 'LOCAL') {
      local += count
    } else {
      server += count
    }
  }
  return { server, local }
}

/**
 * 日次KPIを取得
 * @param {string} userId
 * @param {string} dateKey - "YYYY-MM-DD"
 * @returns {Promise<Object>}
 */
export async function getDailyKpi(userId, dateKey) {
  requireUserId(userId)
  if (!isValidDateKey(dateKey)) {
    throw new ValidationError(`Invalid date key: ${dateKey}`)
  }

  const { start, end } = dateKeyToRange(dateKey)

  const groups = await prisma.segment.groupBy({
    by: ['selectedMode'],
    where: {
      userId,
      createdAt: { gte: start, lte: end },
      sttStatus: 'DONE',
    },
    _count: { id: true },
  })

  const { server, local } = aggregateModeGroups(groups)
  const total = server + local

  return {
    dateKey,
    server,
    local,
    total,
    localRatio: total > 0 ? local / total : 0,
  }
}

/**
 * 週次KPIを取得
 * @param {string} userId
 * @param {string} weekKey - "YYYY-Wxx"
 * @returns {Promise<Object>}
 */
export async function getWeeklyKpi(userId, weekKey) {
  requireUserId(userId)
  if (!isValidWeekKey(weekKey)) {
    throw new ValidationError(`Invalid week key: ${weekKey}`)
  }

  const { start, end } = weekKeyToRange(weekKey)

  const groups = await prisma.segment.groupBy({
    by: ['selectedMode'],
    where: {
      userId,
      createdAt: { gte: start, lte: end },
      sttStatus: 'DONE',
    },
    _count: { id: true },
  })

  const { server, local } = aggregateModeGroups(groups)
  const total = server + local

  return {
    weekKey,
    server,
    local,
    total,
    localRatio: total > 0 ? local / total : 0,
  }
}
