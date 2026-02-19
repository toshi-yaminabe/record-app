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
import { requireUserId, findOwnedOrThrow } from './base-service.js'

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
  requireUserId(userId)

  const where = {
    userId,
    ...(dateKey && { dateKey }),
    ...(status && { status }),
  }

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
  requireUserId(userId)

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
    throw new ValidationError(
      `この日付（${dateKey}）には文字起こし済みの録音がありません。` +
      '先に録音して文字起こしが完了してから、日次提案を生成してください。'
    )
  }

  const memories = await prisma.memory.findMany({
    where: { userId },
    take: 20,
    orderBy: { createdAt: 'desc' },
    select: { text: true },
  })

  const transcriptText = segments.map((s) => s.text).join('\n\n')
  const proposalData = await generateProposals(transcriptText, dateKey, userId, memories)

  await prisma.proposal.createMany({
    data: proposalData.map((item) => ({
      userId,
      dateKey,
      type: item.type || PROPOSAL_TYPE.SUMMARY,
      title: item.title || '(無題)',
      body: item.body || '',
      status: PROPOSAL_STATUS.PENDING,
    })),
  })

  // createManyはIDを返さないため、作成後に取得
  const savedProposals = await prisma.proposal.findMany({
    where: { userId, dateKey, status: PROPOSAL_STATUS.PENDING },
    orderBy: { createdAt: 'asc' },
  })

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
  requireUserId(userId)

  const proposal = await findOwnedOrThrow(prisma.proposal, id, userId, 'Proposal')

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
  requireUserId(userId)

  const proposal = await findOwnedOrThrow(prisma.proposal, id, userId, 'Proposal')

  const updated = await prisma.proposal.update({
    where: { id },
    data: { status: PROPOSAL_STATUS.REJECTED },
  })

  return updated
}
