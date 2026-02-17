/**
 * バリデーションユーティリティ
 */

import { z } from 'zod'
import { TASK_STATUS, NODE_TYPE, RULE_TREE_MAX_DEPTH } from './constants.js'
import { ValidationError } from './errors.js'

// ========================================
// タスク状態遷移マトリクス
// ========================================

/**
 * 許可される状態遷移マップ
 * FROM → [TO1, TO2, ...]
 *
 * FROM\TO   | TODO | DOING | DONE | ARCHIVED
 * ----------|------|-------|------|----------
 * TODO      |  -   |  OK   |  NG  |   OK
 * DOING     |  OK  |  -    |  OK  |   OK
 * DONE      |  OK  |  NG   |  -   |   OK
 * ARCHIVED  |  NG  |  NG   |  NG  |   -
 */
const ALLOWED_TRANSITIONS = Object.freeze({
  [TASK_STATUS.TODO]: [TASK_STATUS.DOING, TASK_STATUS.ARCHIVED],
  [TASK_STATUS.DOING]: [TASK_STATUS.TODO, TASK_STATUS.DONE, TASK_STATUS.ARCHIVED],
  [TASK_STATUS.DONE]: [TASK_STATUS.TODO, TASK_STATUS.ARCHIVED],
  [TASK_STATUS.ARCHIVED]: [], // 最終状態、復帰不可
})

/**
 * タスク状態遷移を検証
 * @param {string} fromStatus - 現在のステータス
 * @param {string} toStatus - 遷移先のステータス
 * @returns {{ valid: boolean, message?: string }}
 */
export function validateTaskTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) {
    return { valid: false, message: `Already in status: ${fromStatus}` }
  }

  const allowed = ALLOWED_TRANSITIONS[fromStatus]
  if (!allowed) {
    return { valid: false, message: `Unknown status: ${fromStatus}` }
  }

  if (!allowed.includes(toStatus)) {
    return { valid: false, message: `Transition from ${fromStatus} to ${toStatus} is not allowed` }
  }

  return { valid: true }
}

// ========================================
// ルールツリーバリデーション
// ========================================

/**
 * ルールツリーを検証
 * - サイクル検出（DFS + visited set）
 * - 深度制限（最大10レベル）
 * - 全終端ノードが分人を指しているかチェック
 * - 孤立ノード検出
 *
 * @param {Array<{ id: string, parentId: string|null, type: string, bunjinSlug: string|null }>} nodes
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRuleTree(nodes) {
  const errors = []

  if (!nodes || nodes.length === 0) {
    return { valid: false, errors: ['Rule tree has no nodes'] }
  }

  // ノードマップ作成
  const nodeMap = new Map()
  for (const node of nodes) {
    nodeMap.set(node.id, node)
  }

  // 子ノードマップ作成
  const childrenMap = new Map()
  for (const node of nodes) {
    if (!childrenMap.has(node.id)) {
      childrenMap.set(node.id, [])
    }
    if (node.parentId) {
      if (!childrenMap.has(node.parentId)) {
        childrenMap.set(node.parentId, [])
      }
      childrenMap.get(node.parentId).push(node.id)
    }
  }

  // ルートノード検出
  const roots = nodes.filter(n => n.parentId === null || n.parentId === undefined)
  if (roots.length === 0) {
    errors.push('No root node found')
    return { valid: false, errors }
  }
  if (roots.length > 1) {
    errors.push(`Multiple root nodes found: ${roots.map(r => r.id).join(', ')}`)
  }

  // DFSでサイクル検出 + 深度制限 + 終端チェック
  const visited = new Set()
  const reachable = new Set()

  function dfs(nodeId, depth, path) {
    if (path.has(nodeId)) {
      errors.push(`Cycle detected involving node: ${nodeId}`)
      return
    }
    if (depth > RULE_TREE_MAX_DEPTH) {
      errors.push(`Tree depth exceeds maximum of ${RULE_TREE_MAX_DEPTH} at node: ${nodeId}`)
      return
    }

    visited.add(nodeId)
    reachable.add(nodeId)
    const newPath = new Set(path)
    newPath.add(nodeId)

    const children = childrenMap.get(nodeId) || []
    const node = nodeMap.get(nodeId)

    if (children.length === 0) {
      // 終端ノード: type が bunjin で bunjinSlug が設定されている必要がある
      if (node.type !== NODE_TYPE.BUNJIN) {
        errors.push(`Leaf node ${nodeId} is not a bunjin node (type: ${node.type})`)
      }
      if (!node.bunjinSlug) {
        errors.push(`Leaf node ${nodeId} has no bunjinSlug assigned`)
      }
    }

    for (const childId of children) {
      dfs(childId, depth + 1, newPath)
    }
  }

  for (const root of roots) {
    dfs(root.id, 0, new Set())
  }

  // 孤立ノード検出
  for (const node of nodes) {
    if (!reachable.has(node.id)) {
      errors.push(`Orphan node detected: ${node.id} (unreachable from root)`)
    }
  }

  return { valid: errors.length === 0, errors }
}

// ========================================
// 日付・週キー検証
// ========================================

/**
 * YYYY-MM-DD 形式の日付キーを検証
 * @param {string} dateKey
 * @returns {boolean}
 */
export function isValidDateKey(dateKey) {
  if (!dateKey || typeof dateKey !== 'string') return false
  const match = /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
  if (!match) return false
  const date = new Date(dateKey + 'T00:00:00Z')
  return !isNaN(date.getTime())
}

/**
 * YYYY-Wxx 形式の週キーを検証
 * @param {string} weekKey
 * @returns {boolean}
 */
export function isValidWeekKey(weekKey) {
  if (!weekKey || typeof weekKey !== 'string') return false
  return /^\d{4}-W\d{2}$/.test(weekKey)
}

/**
 * 今日の日付キーを取得（UTC）
 * @returns {string} "YYYY-MM-DD"
 */
export function getTodayDateKey() {
  return new Date().toISOString().slice(0, 10)
}

// ========================================
// Zod Schemas
// ========================================

export const taskCreateSchema = z.object({
  title: z.string().min(1).max(500),
  body: z.string().max(5000).optional(),
  bunjinId: z.string().uuid().optional().nullable(),
  priority: z.number().int().min(0).max(100).optional(),
})

export const taskUpdateSchema = z.object({
  status: z.enum(['TODO', 'DOING', 'DONE', 'ARCHIVED']),
})

export const bunjinCreateSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).min(1).max(50),
  displayName: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(50).optional(),
})

export const bunjinUpdateSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).min(1).max(50).optional(),
  displayName: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(50).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field is required' })

export const sessionCreateSchema = z.object({
  deviceId: z.string().min(1).max(200),
})

export const segmentCreateSchema = z.object({
  sessionId: z.string().uuid(),
  segmentNo: z.number().int().min(0),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  storageObjectPath: z.string().optional(),
})

export const segmentUpdateSchema = z.object({
  sttStatus: z.enum(['PENDING', 'PROCESSING', 'DONE', 'FAILED']).optional(),
  text: z.string().max(100000).optional(),
}).refine(data => data.sttStatus || data.text !== undefined, { message: 'sttStatus or text is required' })

export const proposalCreateSchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export const proposalUpdateSchema = z.object({
  status: z.enum(['CONFIRMED', 'REJECTED']),
})

export const swlsSchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q1: z.string().max(500).optional(),
  q2: z.string().max(500).optional(),
  q3: z.string().max(500).optional(),
  q4: z.string().max(500).optional(),
  q5: z.string().max(500).optional(),
})

export const memoryCreateSchema = z.object({
  text: z.string().min(1).max(50000),
  bunjinId: z.string().uuid().optional().nullable(),
  sourceRefs: z.string().max(5000).optional(),
})

export const memoryUpdateSchema = z.object({
  text: z.string().min(1).max(50000),
})

export const settingsSchema = z.object({
  geminiApiKey: z.string().min(10),
})

export const weeklyCreateSchema = z.object({
  weekKey: z.string().regex(/^\d{4}-W\d{2}$/),
  proposalId: z.string().uuid(),
  note: z.string().max(5000).optional(),
})

/**
 * Zodスキーマでリクエストボディを検証
 * @param {z.ZodSchema} schema
 * @param {Object} data
 * @returns {Object} validated data
 * @throws {ValidationError}
 */
export function validateBody(schema, data) {
  const result = schema.safeParse(data)
  if (!result.success) {
    const messages = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    throw new ValidationError(messages)
  }
  return result.data
}

