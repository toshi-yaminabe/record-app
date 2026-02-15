/**
 * ルールツリーサービス
 * - ドラフト編集 → 検証 → 公開のワークフロー
 * - 公開時に全ノードをJSONスナップショット化
 */

import { prisma } from '@/lib/prisma.js'
import { validateRuleTree } from '@/lib/validators.js'
import { ValidationError, NotFoundError } from '@/lib/errors.js'

// ========================================
// ツリー取得
// ========================================

/**
 * ユーザーのルールツリーとノードを取得
 * @param {string} userId - ユーザーID
 * @returns {Promise<{ id: string, nodes: Array }>}
 */
export async function getRuleTree(userId) {
  if (!userId) throw new ValidationError('userId is required')

  let ruleTree = await prisma.ruleTree.findFirst({
    where: { userId },
    include: {
      nodes: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  if (!ruleTree) {
    ruleTree = await prisma.ruleTree.create({
      data: { userId, name: 'default' },
      include: { nodes: true },
    })
  }

  return {
    id: ruleTree.id,
    nodes: ruleTree.nodes,
  }
}

// ========================================
// ツリー全置換（ドラフト編集）
// ========================================

/**
 * ドラフトツリーを全置換
 * @param {string} userId - ユーザーID
 * @param {Array} nodes - 新しいノードセット
 * @returns {Promise<Array>}
 */
export async function replaceRuleTree(userId, nodes) {
  if (!userId) throw new ValidationError('userId is required')

  let ruleTree = await prisma.ruleTree.findFirst({
    where: { userId },
  })

  if (!ruleTree) {
    ruleTree = await prisma.ruleTree.create({
      data: { userId, name: 'default' },
    })
  }

  if (!Array.isArray(nodes)) {
    throw new ValidationError('nodes must be an array')
  }

  for (const node of nodes) {
    if (!node.type || typeof node.sortOrder !== 'number') {
      throw new ValidationError('Each node must have type and sortOrder')
    }
  }

  const newNodes = await prisma.$transaction(async (tx) => {
    await tx.ruleTreeNode.deleteMany({
      where: { ruleTreeId: ruleTree.id },
    })

    const sortedNodes = topologicalSort(nodes)

    const tempIdMap = new Map()
    const createdNodes = []

    for (const node of sortedNodes) {
      const actualParentId = node.parentId
        ? (tempIdMap.get(node.parentId) ?? node.parentId)
        : null

      const created = await tx.ruleTreeNode.create({
        data: {
          ruleTreeId: ruleTree.id,
          parentId: actualParentId,
          type: node.type,
          label: node.label ?? '',
          condition: node.condition,
          bunjinSlug: node.bunjinSlug,
          sortOrder: node.sortOrder,
        },
      })

      if (node.id) {
        tempIdMap.set(node.id, created.id)
      }
      createdNodes.push(created)
    }

    return createdNodes
  })

  return newNodes
}

/**
 * ノード配列をトポロジカルソート（親が必ず子より先に来る）
 * @param {Array} nodes
 * @returns {Array}
 */
export function topologicalSort(nodes) {
  const childrenMap = new Map()
  const roots = []

  for (const node of nodes) {
    if (!node.parentId) {
      roots.push(node)
    } else {
      const children = childrenMap.get(node.parentId) || []
      children.push(node)
      childrenMap.set(node.parentId, children)
    }
  }

  const sorted = []
  const queue = [...roots]

  while (queue.length > 0) {
    const current = queue.shift()
    sorted.push(current)

    if (current.id) {
      const children = childrenMap.get(current.id) || []
      for (const child of children) {
        queue.push(child)
      }
    }
  }

  return sorted
}

// ========================================
// ツリー公開
// ========================================

/**
 * ルールツリーを検証して公開
 * @param {string} userId - ユーザーID
 * @returns {Promise<Object>} 作成された PublishedVersion
 */
export async function publishRuleTree(userId) {
  if (!userId) throw new ValidationError('userId is required')

  const ruleTree = await prisma.ruleTree.findFirst({
    where: { userId },
    include: {
      nodes: {
        orderBy: { sortOrder: 'asc' },
      },
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  })

  if (!ruleTree) {
    throw new NotFoundError('RuleTree', userId)
  }

  if (ruleTree.nodes.length === 0) {
    throw new ValidationError('Cannot publish empty rule tree')
  }

  const validation = validateRuleTree(ruleTree.nodes)
  if (!validation.valid) {
    throw new ValidationError(`Rule tree validation failed: ${validation.errors.join(', ')}`)
  }

  const latestVersion = ruleTree.versions[0]
  const nextVersion = latestVersion ? latestVersion.version + 1 : 1

  const treeJson = JSON.stringify(ruleTree.nodes)

  const publishedVersion = await prisma.publishedVersion.create({
    data: {
      ruleTreeId: ruleTree.id,
      version: nextVersion,
      treeJson,
    },
  })

  return publishedVersion
}
