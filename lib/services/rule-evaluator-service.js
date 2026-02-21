/**
 * ルール評価サービス (#63)
 * - STT完了後にルールツリーを評価してセグメントにbunjinIdを自動割当
 * - 条件式: 時間帯ベース (hour >= N && hour < M) + テキストキーワード (text.includes("keyword"))
 */

import { prisma } from '@/lib/prisma.js'
import { NODE_TYPE } from '@/lib/constants.js'
import { logger } from '@/lib/logger.js'

// ========================================
// 条件式の安全な評価
// ========================================

/**
 * 条件式を安全に評価する（複合条件対応）
 *
 * サポートする式:
 * - 時間帯: "hour >= N && hour < M", "hour >= N || hour < M"
 * - テキスト: 'text.includes("キーワード")'
 * - 複合: 'hour >= 9 && text.includes("会議")'
 * - カテゴリラベル: "time_of_day", "keyword" (常にtrue、分岐ノード用)
 *
 * @param {string} condition - 条件式文字列
 * @param {Object} context - 評価コンテキスト
 * @param {number} context.hour - 時 (0-23)
 * @param {string} [context.text] - STTテキスト
 * @returns {boolean}
 */
function evaluateCondition(condition, context) {
  if (!condition || typeof condition !== 'string') return false

  const hasHourCheck = /hour\s*[><=!]/.test(condition)
  const hasTextCheck = condition.includes('text.includes(')

  // カテゴリラベル（"time_of_day", "keyword"等）→ 常にtrue
  if (!hasHourCheck && !hasTextCheck) {
    return true
  }

  const isOr = condition.includes('||')
  const results = []

  // 時間帯条件の評価
  if (hasHourCheck) {
    results.push(evaluateHourConditions(condition, context.hour))
  }

  // テキストキーワード条件の評価
  if (hasTextCheck) {
    results.push(evaluateTextConditions(condition, context.text))
  }

  // OR / AND 統合
  return isOr ? results.some(r => r) : results.every(r => r)
}

/**
 * 時間帯条件を評価
 * @param {string} condition - 条件式全体
 * @param {number} hour - 時 (0-23)
 * @returns {boolean}
 */
function evaluateHourConditions(condition, hour) {
  const comparisons = condition.match(/hour\s*([><=!]+)\s*(\d+)/g)
  if (!comparisons || comparisons.length === 0) return false

  const results = comparisons.map(comp => {
    const match = comp.match(/hour\s*([><=!]+)\s*(\d+)/)
    if (!match) return false

    const operator = match[1]
    const value = parseInt(match[2], 10)

    switch (operator) {
      case '>=': return hour >= value
      case '>': return hour > value
      case '<=': return hour <= value
      case '<': return hour < value
      case '==': return hour === value
      case '!=': return hour !== value
      default: return false
    }
  })

  // 時間帯内の複数条件は常にAND（"hour >= 6 && hour < 12"）
  // OR判定はトップレベルで処理（"hour >= 22 || hour < 6"）
  if (condition.includes('||') && !condition.includes('text.includes(')) {
    return results.some(r => r)
  }
  return results.every(r => r)
}

/**
 * テキストキーワード条件を評価
 * @param {string} condition - 条件式全体
 * @param {string} [text] - STTテキスト
 * @returns {boolean}
 */
function evaluateTextConditions(condition, text) {
  const textIncludes = condition.match(/text\.includes\(["'](.+?)["']\)/g)
  if (!textIncludes || textIncludes.length === 0) return false

  const lowerText = (text || '').toLowerCase()
  const results = textIncludes.map(expr => {
    const keyMatch = expr.match(/text\.includes\(["'](.+?)["']\)/)
    return keyMatch ? lowerText.includes(keyMatch[1].toLowerCase()) : false
  })

  return results.every(r => r)
}

// ========================================
// ツリー構築と探索
// ========================================

/**
 * フラットなノード配列からツリー構造を構築
 * @param {Array} nodes - PublishedVersion.treeJson のパース結果
 * @returns {{ roots: Array, childrenMap: Map }}
 */
function buildTree(nodes) {
  const childrenMap = new Map()
  const roots = []

  for (const node of nodes) {
    if (!childrenMap.has(node.id)) {
      childrenMap.set(node.id, [])
    }
    if (node.parentId) {
      if (!childrenMap.has(node.parentId)) {
        childrenMap.set(node.parentId, [])
      }
      childrenMap.get(node.parentId).push(node)
    } else {
      roots.push(node)
    }
  }

  // 各レベルでsortOrder順にソート
  for (const [, children] of childrenMap) {
    children.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  return { roots, childrenMap }
}

/**
 * ルールツリーを評価して該当するbunjinSlugを返す
 * @param {Array} nodes - ツリーノード配列
 * @param {Object} context - 評価コンテキスト
 * @returns {string|null} マッチしたbunjinSlug
 */
function evaluateTree(nodes, context) {
  const { roots, childrenMap } = buildTree(nodes)

  for (const root of roots) {
    const result = evaluateNode(root, childrenMap, context)
    if (result) return result
  }

  return null
}

/**
 * 単一ノードを再帰的に評価
 * @param {Object} node
 * @param {Map} childrenMap
 * @param {Object} context
 * @returns {string|null}
 */
function evaluateNode(node, childrenMap, context) {
  // 終端: bunjinノード → slugを返す
  if (node.type === NODE_TYPE.BUNJIN) {
    return node.bunjinSlug || null
  }

  // 条件ノード: 条件を評価
  if (node.type === NODE_TYPE.CONDITION) {
    const conditionMatch = evaluateCondition(node.condition, context)
    if (!conditionMatch) return null

    const children = childrenMap.get(node.id) || []

    // 子ノードを順に評価（最初にマッチしたものを返す）
    for (const child of children) {
      const result = evaluateNode(child, childrenMap, context)
      if (result) return result
    }

    // 条件マッチしたが子がない場合はnull
    return null
  }

  return null
}

// ========================================
// メインサービス関数
// ========================================

/**
 * セグメントのルールツリーを評価し、bunjinIdを自動割当する
 *
 * @param {string} userId - ユーザーID
 * @param {Object} segment - 作成/更新されたセグメント
 * @param {string} segment.id - セグメントID
 * @param {string} segment.sessionId - セッションID
 * @param {Date|string} segment.startAt - セグメント開始時刻
 * @param {string} [segment.text] - STTテキスト（テキストベース条件に使用）
 * @returns {Promise<Object|null>} 更新されたセグメント（bunjinId付き）、またはnull
 */
export async function evaluateAndAssignBunjin(userId, segment) {
  // 1. セッションの公開ルールバージョンを取得
  const session = await prisma.session.findFirst({
    where: { id: segment.sessionId, userId },
    select: { ruleVersionId: true },
  })

  if (!session?.ruleVersionId) {
    logger.debug('No rule version assigned to session, skipping bunjin evaluation', {
      component: 'rule-evaluator',
      sessionId: segment.sessionId,
    })
    return null
  }

  // 2. 公開バージョンのtreeJsonを取得
  const publishedVersion = await prisma.publishedVersion.findUnique({
    where: { id: session.ruleVersionId },
    select: { treeJson: true },
  })

  if (!publishedVersion?.treeJson) {
    return null
  }

  let nodes
  try {
    nodes = JSON.parse(publishedVersion.treeJson)
  } catch {
    logger.warn('Failed to parse treeJson', {
      component: 'rule-evaluator',
      ruleVersionId: session.ruleVersionId,
    })
    return null
  }

  if (!Array.isArray(nodes) || nodes.length === 0) {
    return null
  }

  // 3. 評価コンテキスト構築（時間帯 + テキスト内容）
  const startAt = new Date(segment.startAt)
  if (isNaN(startAt.getTime())) {
    logger.warn('Invalid segment.startAt for rule evaluation', {
      component: 'rule-evaluator',
      segmentId: segment.id,
      startAt: segment.startAt,
    })
    return null
  }

  const context = {
    hour: startAt.getUTCHours(),
    text: segment.text || '',
  }

  // 4. ツリー評価
  const bunjinSlug = evaluateTree(nodes, context)

  if (!bunjinSlug) {
    logger.debug('No bunjin matched in rule tree evaluation', {
      component: 'rule-evaluator',
      segmentId: segment.id,
      hour: context.hour,
    })
    return null
  }

  // 5. slug → bunjinId 変換
  const bunjin = await prisma.bunjin.findFirst({
    where: { userId, slug: bunjinSlug },
    select: { id: true },
  })

  if (!bunjin) {
    logger.warn('Bunjin slug from rule tree not found in user bunjins', {
      component: 'rule-evaluator',
      bunjinSlug,
      userId,
    })
    return null
  }

  // 6. セグメントにbunjinIdを設定（userId所有権チェック付き）
  const updateResult = await prisma.segment.updateMany({
    where: { id: segment.id, userId },
    data: { bunjinId: bunjin.id },
  })

  if (updateResult.count === 0) {
    logger.warn('Segment not found or not owned by user for bunjin assignment', {
      component: 'rule-evaluator',
      segmentId: segment.id,
      userId,
    })
    return null
  }

  // 更新後のセグメントを取得して返す
  const updated = await prisma.segment.findUnique({
    where: { id: segment.id },
  })

  logger.info('Auto-assigned bunjin to segment via rule tree', {
    component: 'rule-evaluator',
    segmentId: segment.id,
    bunjinSlug,
    bunjinId: bunjin.id,
  })

  return updated
}
