/**
 * 週次レビューサービス
 * - 週次実行記録の取得・作成
 */

import { prisma } from '@/lib/prisma.js'
import { isValidWeekKey } from '@/lib/validators.js'
import { ValidationError, NotFoundError } from '@/lib/errors.js'
import { requireUserId } from './base-service.js'

// ========================================
// 週次レビュー取得
// ========================================

/**
 * 指定週の実行記録を取得
 * @param {string} userId - ユーザーID
 * @param {string} weekKey - "YYYY-Wxx"
 * @returns {Promise<Array>}
 */
export async function getWeeklyReview(userId, weekKey) {
  requireUserId(userId)

  if (!isValidWeekKey(weekKey)) {
    throw new ValidationError(`Invalid weekKey format: ${weekKey}`)
  }

  const executions = await prisma.weeklyExecution.findMany({
    where: { userId, weekKey },
    include: {
      proposal: {
        select: {
          id: true,
          dateKey: true,
          type: true,
          title: true,
          body: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return executions
}

// ========================================
// 週次実行記録の作成
// ========================================

/**
 * 週次実行記録を作成
 * @param {string} userId - ユーザーID
 * @param {{ weekKey: string, proposalId: string, note?: string }} data
 * @returns {Promise<Object>}
 */
export async function createWeeklyExecution(userId, data) {
  requireUserId(userId)

  const { weekKey, proposalId, note } = data

  if (!isValidWeekKey(weekKey)) {
    throw new ValidationError(`Invalid weekKey format: ${weekKey}`)
  }

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
  })

  if (!proposal || proposal.userId !== userId) {
    throw new NotFoundError('Proposal', proposalId)
  }

  const existing = await prisma.weeklyExecution.findUnique({
    where: {
      userId_weekKey_proposalId: { userId, weekKey, proposalId },
    },
  })

  if (existing) {
    throw new ValidationError('Weekly execution already exists for this proposal and week')
  }

  const execution = await prisma.weeklyExecution.create({
    data: {
      userId,
      weekKey,
      proposalId,
      note: note ?? '',
    },
    include: {
      proposal: {
        select: {
          id: true,
          dateKey: true,
          type: true,
          title: true,
          body: true,
          status: true,
        },
      },
    },
  })

  return execution
}
