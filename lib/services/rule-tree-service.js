/**
 * ルールツリーサービス
 * - ドラフト編集 → 検証 → 公開のワークフロー
 * - 公開時に全ノードをJSONスナップショット化
 */

import { prisma } from '@/lib/prisma.js'
import { MOCK_USER_ID } from '@/lib/constants.js'
import { validateRuleTree } from '@/lib/validators.js'
import { ValidationError, NotFoundError } from '@/lib/errors.js'

// ========================================
// ツリー取得
// ========================================

/**
 * ユーザーのルールツリーとノードを取得
 * - ユーザーごとに1つのRuleTreeが存在（初回自動生成）
 * - ノードはsortOrder順
 *
 * @returns {Promise<{ id: string, nodes: Array }>}
 */
export async function getRuleTree() {
  // RuleTreeを取得または作成
  let ruleTree = await prisma.ruleTree.findFirst({
    where: { userId: MOCK_USER_ID },
    include: {
      nodes: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  if (!ruleTree) {
    // 初回アクセス時に空のツリー作成
    ruleTree = await prisma.ruleTree.create({
      data: {
        userId: MOCK_USER_ID,
        name: 'default',
      },
      include: {
        nodes: true,
      },
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
 * - 既存の全ノードを削除し、新しいノードセットで置き換え
 * - バリデーションはここでは行わない（publish時に実施）
 *
 * @param {Array<{ parentId?: string, type: string, label?: string, condition?: string, bunjinSlug?: string, sortOrder: number }>} nodes
 * @returns {Promise<Array>}
 * @throws {ValidationError} 必須フィールド不足
 */
export async function replaceRuleTree(nodes) {
  // ツリー取得または作成
  let ruleTree = await prisma.ruleTree.findFirst({
    where: { userId: MOCK_USER_ID },
  })

  if (!ruleTree) {
    ruleTree = await prisma.ruleTree.create({
      data: {
        userId: MOCK_USER_ID,
        name: 'default',
      },
    })
  }

  // ノード検証（基本フィールドのみ）
  if (!Array.isArray(nodes)) {
    throw new ValidationError('nodes must be an array')
  }

  for (const node of nodes) {
    if (!node.type || typeof node.sortOrder !== 'number') {
      throw new ValidationError('Each node must have type and sortOrder')
    }
  }

  // トランザクションで全置換
  const newNodes = await prisma.$transaction(async (tx) => {
    // 既存ノードを全削除
    await tx.ruleTreeNode.deleteMany({
      where: { ruleTreeId: ruleTree.id },
    })

    // 新しいノードを一括作成
    // 注: parentIdは既存ノードを参照する可能性があるため、一時IDマップを作成
    const tempIdMap = new Map() // 仮ID → 実ID
    const createdNodes = []

    // 第1パス: parentId=nullのノードを作成
    for (const node of nodes.filter(n => !n.parentId)) {
      const created = await tx.ruleTreeNode.create({
        data: {
          ruleTreeId: ruleTree.id,
          parentId: null,
          type: node.type,
          label: node.label ?? '',
          condition: node.condition,
          bunjinSlug: node.bunjinSlug,
          sortOrder: node.sortOrder,
        },
      })
      // 元のノードに仮IDがあれば記録
      if (node.id) {
        tempIdMap.set(node.id, created.id)
      }
      createdNodes.push(created)
    }

    // 第2パス: parentIdを持つノードを作成
    for (const node of nodes.filter(n => n.parentId)) {
      // parentIdが仮IDの場合は実IDに変換
      const actualParentId = tempIdMap.get(node.parentId) ?? node.parentId

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

// ========================================
// ツリー公開
// ========================================

/**
 * ルールツリーを検証して公開
 * - validateRuleTree でサイクル、深度、終端ノードをチェック
 * - 新しい PublishedVersion を作成（version自動インクリメント）
 * - treeJsonに全ノードをスナップショット
 *
 * @returns {Promise<Object>} 作成された PublishedVersion
 * @throws {ValidationError} ツリー検証失敗
 * @throws {NotFoundError} RuleTreeが存在しない
 */
export async function publishRuleTree() {
  // ツリー取得
  const ruleTree = await prisma.ruleTree.findFirst({
    where: { userId: MOCK_USER_ID },
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
    throw new NotFoundError('RuleTree', MOCK_USER_ID)
  }

  if (ruleTree.nodes.length === 0) {
    throw new ValidationError('Cannot publish empty rule tree')
  }

  // ツリー検証
  const validation = validateRuleTree(ruleTree.nodes)
  if (!validation.valid) {
    throw new ValidationError(`Rule tree validation failed: ${validation.errors.join(', ')}`)
  }

  // 次のバージョン番号を計算
  const latestVersion = ruleTree.versions[0]
  const nextVersion = latestVersion ? latestVersion.version + 1 : 1

  // JSONスナップショット作成
  const treeJson = JSON.stringify(ruleTree.nodes)

  // PublishedVersion作成
  const publishedVersion = await prisma.publishedVersion.create({
    data: {
      ruleTreeId: ruleTree.id,
      version: nextVersion,
      treeJson,
    },
  })

  return publishedVersion
}
