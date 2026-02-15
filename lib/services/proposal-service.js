/**
 * 提案サービス
 * - 提案の一覧取得・生成・確定・却下
 * - タスク提案の確定時に自動タスク作成
 */

import { prisma } from '@/lib/prisma.js'
import { PROPOSAL_STATUS, PROPOSAL_TYPE, TASK_STATUS } from '@/lib/constants.js'
import { generateProposals } from '@/lib/gemini.js'
import { isValidDateKey } from '@/lib/validators.js'
import { ValidationError, NotFoundError } from '@/lib/errors.js'

// ========================================
// 提案一覧取得
// ========================================

/**
 * 提案を一覧取得
 * @param {string} userId - ユーザーID
 * @param {{ dateKey?: string, status?: string }} options
 * @returns {Promise<Array>}
 */
export async function listProposals(userId, { dateKey, status } = {}) {
  if (!userId) throw new ValidationError('userId is required')

  const where = { userId }
  if (dateKey) where.dateKey = dateKey
  if (status) where.status = status

  const proposals = await prisma.proposal.findMany({
    where,
    orderBy: [
      { dateKey: 'desc' },
      { createdAt: 'asc' },
    ],
  })

  return proposals
}

// ========================================
// 日次提案生成
// ========================================

/**
 * 指定日の提案を生成
 * @param {string} userId - ユーザーID
 * @param {string} dateKey - "YYYY-MM-DD"
 * @returns {Promise<Array>} 生成された提案一覧
 */
export async function generateDailyProposals(userId, dateKey) {
  if (!userId) throw new ValidationError('userId is required')

  if (!isValidDateKey(dateKey)) {
    throw new ValidationError(`Invalid dateKey format: ${dateKey}`)
  }

  const startOfDay = new Date(dateKey + 'T00:00:00Z')
  const endOfDay = new Date(dateKey + 'T23:59:59Z')

  const segments = await prisma.segment.findMany({
    where: {
      userId,
      startAt: { gte: startOfDay, lte: endOfDay },
      sttStatus: 'DONE',
      text: { not: null },
    },
    orderBy: { startAt: 'asc' },
    select: { text: true },
  })

  if (segments.length === 0) {
    throw new ValidationError(`No segments found for date: ${dateKey}`)
  }

  const transcriptText = segments.map((s) => s.text).join('\n\n')
  const proposalData = await generateProposals(transcriptText, dateKey, userId)

  const savedProposals = []
  for (const item of proposalData) {
    const proposal = await prisma.proposal.create({
      data: {
        userId,
        dateKey,
        type: item.type || PROPOSAL_TYPE.SUMMARY,
        title: item.title || '(無題)',
        body: item.body || '',
        status: PROPOSAL_STATUS.PENDING,
      },
    })
    savedProposals.push(proposal)
  }

  return savedProposals
}

// ========================================
// 提案の確定
// ========================================

/**
 * 提案を確定
 * @param {string} userId - ユーザーID
 * @param {string} id - 提案ID
 * @returns {Promise<{ proposal: Object, task?: Object }>}
 */
export async function confirmProposal(userId, id) {
  if (!userId) throw new ValidationError('userId is required')

  const proposal = await prisma.proposal.findUnique({ where: { id } })

  if (!proposal || proposal.userId !== userId) {
    throw new NotFoundError('Proposal', id)
  }

  if (proposal.status === PROPOSAL_STATUS.CONFIRMED) {
    throw new ValidationError('Proposal is already confirmed')
  }

  const updated = await prisma.proposal.update({
    where: { id },
    data: { status: PROPOSAL_STATUS.CONFIRMED },
  })

  let createdTask = null

  if (proposal.type === PROPOSAL_TYPE.TASK) {
    createdTask = await prisma.task.create({
      data: {
        userId,
        title: proposal.title,
        body: proposal.body,
        status: TASK_STATUS.TODO,
        priority: 0,
      },
    })
  }

  return {
    proposal: updated,
    task: createdTask,
  }
}

// ========================================
// 提案の却下
// ========================================

/**
 * 提案を却下
 * @param {string} userId - ユーザーID
 * @param {string} id - 提案ID
 * @returns {Promise<Object>}
 */
export async function rejectProposal(userId, id) {
  if (!userId) throw new ValidationError('userId is required')

  const proposal = await prisma.proposal.findUnique({ where: { id } })

  if (!proposal || proposal.userId !== userId) {
    throw new NotFoundError('Proposal', id)
  }

  const updated = await prisma.proposal.update({
    where: { id },
    data: { status: PROPOSAL_STATUS.REJECTED },
  })

  return updated
}
