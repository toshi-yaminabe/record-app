/**
 * 提案サービス
 * - 提案の一覧取得・生成・確定・却下
 * - タスク提案の確定時に自動タスク作成
 */

import { prisma } from '@/lib/prisma.js'
import { MOCK_USER_ID, PROPOSAL_STATUS, PROPOSAL_TYPE, TASK_STATUS } from '@/lib/constants.js'
import { generateProposals } from '@/lib/gemini.js'
import { isValidDateKey } from '@/lib/validators.js'
import { ValidationError, NotFoundError } from '@/lib/errors.js'

// ========================================
// 提案一覧取得
// ========================================

/**
 * 提案を一覧取得
 * @param {{ dateKey?: string, status?: string }} options
 * @returns {Promise<Array>}
 */
export async function listProposals({ dateKey, status } = {}) {
  const where = {
    userId: MOCK_USER_ID,
  }

  if (dateKey) {
    where.dateKey = dateKey
  }

  if (status) {
    where.status = status
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
 * - その日のセグメントをすべて取得
 * - テキストを結合してGeminiに投げる
 * - 返ってきた提案をDBに保存
 *
 * @param {string} dateKey - "YYYY-MM-DD"
 * @returns {Promise<Array>} 生成された提案一覧
 * @throws {ValidationError} 不正な日付キー
 */
export async function generateDailyProposals(dateKey) {
  // 日付キー検証
  if (!isValidDateKey(dateKey)) {
    throw new ValidationError(`Invalid dateKey format: ${dateKey}`)
  }

  // その日のセグメントを取得
  const startOfDay = new Date(dateKey + 'T00:00:00Z')
  const endOfDay = new Date(dateKey + 'T23:59:59Z')

  const segments = await prisma.segment.findMany({
    where: {
      userId: MOCK_USER_ID,
      startAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
      sttStatus: 'DONE',
      text: {
        not: null,
      },
    },
    orderBy: { startAt: 'asc' },
    select: { text: true },
  })

  if (segments.length === 0) {
    throw new ValidationError(`No segments found for date: ${dateKey}`)
  }

  // テキストを結合
  const transcriptText = segments.map((s) => s.text).join('\n\n')

  // Geminiで提案生成
  const proposalData = await generateProposals(transcriptText, dateKey)

  // DB保存
  const savedProposals = []
  for (const item of proposalData) {
    const proposal = await prisma.proposal.create({
      data: {
        userId: MOCK_USER_ID,
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
 * - ステータスをCONFIRMEDに変更
 * - type=TASKの場合、新しいタスクを作成
 *
 * @param {string} id - 提案ID
 * @returns {Promise<{ proposal: Object, task?: Object }>}
 * @throws {NotFoundError} 提案が存在しない
 * @throws {ValidationError} すでに確定済み
 */
export async function confirmProposal(id) {
  // 提案存在確認
  const proposal = await prisma.proposal.findUnique({
    where: { id },
  })

  if (!proposal || proposal.userId !== MOCK_USER_ID) {
    throw new NotFoundError('Proposal', id)
  }

  if (proposal.status === PROPOSAL_STATUS.CONFIRMED) {
    throw new ValidationError('Proposal is already confirmed')
  }

  // ステータス更新
  const updated = await prisma.proposal.update({
    where: { id },
    data: { status: PROPOSAL_STATUS.CONFIRMED },
  })

  let createdTask = null

  // TASK提案の場合はタスク作成
  if (proposal.type === PROPOSAL_TYPE.TASK) {
    createdTask = await prisma.task.create({
      data: {
        userId: MOCK_USER_ID,
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
 * - ステータスをREJECTEDに変更
 *
 * @param {string} id - 提案ID
 * @returns {Promise<Object>}
 * @throws {NotFoundError} 提案が存在しない
 */
export async function rejectProposal(id) {
  // 提案存在確認
  const proposal = await prisma.proposal.findUnique({
    where: { id },
  })

  if (!proposal || proposal.userId !== MOCK_USER_ID) {
    throw new NotFoundError('Proposal', id)
  }

  // ステータス更新
  const updated = await prisma.proposal.update({
    where: { id },
    data: { status: PROPOSAL_STATUS.REJECTED },
  })

  return updated
}
