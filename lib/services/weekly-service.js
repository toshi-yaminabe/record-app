/**
 * 週次レビューサービス
 * - 週次実行記録の取得・作成
 */

import { prisma } from '@/lib/prisma.js'
import { MOCK_USER_ID } from '@/lib/constants.js'
import { isValidWeekKey } from '@/lib/validators.js'
import { ValidationError, NotFoundError } from '@/lib/errors.js'

// ========================================
// 週次レビュー取得
// ========================================

/**
 * 指定週の実行記録を取得
 * @param {string} weekKey - "YYYY-Wxx"
 * @returns {Promise<Array>}
 * @throws {ValidationError} 不正な週キー
 */
export async function getWeeklyReview(weekKey) {
  // 週キー検証
  if (!isValidWeekKey(weekKey)) {
    throw new ValidationError(`Invalid weekKey format: ${weekKey}`)
  }

  const executions = await prisma.weeklyExecution.findMany({
    where: {
      userId: MOCK_USER_ID,
      weekKey,
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
    orderBy: { createdAt: 'asc' },
  })

  return executions
}

// ========================================
// 週次実行記録の作成
// ========================================

/**
 * 週次実行記録を作成
 * - 提案IDが存在するか検証
 * - 重複登録を防止（userId, weekKey, proposalIdでユニーク）
 *
 * @param {{ weekKey: string, proposalId: string, note?: string }} data
 * @returns {Promise<Object>}
 * @throws {ValidationError} 不正な週キーまたは提案が存在しない
 */
export async function createWeeklyExecution(data) {
  const { weekKey, proposalId, note } = data

  // 週キー検証
  if (!isValidWeekKey(weekKey)) {
    throw new ValidationError(`Invalid weekKey format: ${weekKey}`)
  }

  // 提案存在確認
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
  })

  if (!proposal || proposal.userId !== MOCK_USER_ID) {
    throw new NotFoundError('Proposal', proposalId)
  }

  // 重複チェック（ユニーク制約でエラーになるが事前にチェック）
  const existing = await prisma.weeklyExecution.findUnique({
    where: {
      userId_weekKey_proposalId: {
        userId: MOCK_USER_ID,
        weekKey,
        proposalId,
      },
    },
  })

  if (existing) {
    throw new ValidationError('Weekly execution already exists for this proposal and week')
  }

  // 作成
  const execution = await prisma.weeklyExecution.create({
    data: {
      userId: MOCK_USER_ID,
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
