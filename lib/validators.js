/**
 * バリデーションユーティリティ
 */

import { TASK_STATUS, NODE_TYPE, RULE_TREE_MAX_DEPTH } from './constants.js'

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

/**
 * 今週の週キーを取得（ISO 8601）
 * @returns {string} "YYYY-Wxx"
 */
export function getCurrentWeekKey() {
  const now = new Date()
  const year = now.getUTCFullYear()
  const jan1 = new Date(Date.UTC(year, 0, 1))
  const dayOfYear = Math.floor((now.getTime() - jan1.getTime()) / 86400000) + 1
  const weekNo = Math.ceil((dayOfYear + jan1.getUTCDay()) / 7)
  return `${year}-W${String(weekNo).padStart(2, '0')}`
}
