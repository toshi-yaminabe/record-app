/**
 * Prisma Seed Script
 * 実行順序: Bunjin → RuleTree → RuleTreeNode → PublishedVersion
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MOCK_USER_ID = 'mock-user-001'

const DEFAULT_BUNJINS = [
  { slug: 'work', displayName: '仕事モード', description: '業務・プロジェクト関連', color: '#3b82f6', icon: 'work' },
  { slug: 'creative', displayName: 'クリエイティブ', description: '創作・アイデア出し', color: '#8b5cf6', icon: 'palette' },
  { slug: 'social', displayName: 'ソーシャル', description: '対人関係・コミュニケーション', color: '#ec4899', icon: 'people' },
  { slug: 'rest', displayName: '休息', description: 'リラックス・回復', color: '#10b981', icon: 'self_improvement' },
  { slug: 'learning', displayName: '学習', description: '勉強・スキルアップ', color: '#f59e0b', icon: 'school' },
]

async function main() {
  console.log('Seeding database...')

  // 1. Bunjin作成（デフォルト5件）
  console.log('Creating default bunjins...')
  const bunjins = []
  for (const b of DEFAULT_BUNJINS) {
    const bunjin = await prisma.bunjin.upsert({
      where: { userId_slug: { userId: MOCK_USER_ID, slug: b.slug } },
      update: {},
      create: {
        userId: MOCK_USER_ID,
        slug: b.slug,
        displayName: b.displayName,
        description: b.description,
        color: b.color,
        icon: b.icon,
        isDefault: true,
      },
    })
    bunjins.push(bunjin)
    console.log(`  Created bunjin: ${bunjin.slug} (${bunjin.id})`)
  }

  // 2. RuleTree作成
  console.log('Creating default rule tree...')
  const ruleTree = await prisma.ruleTree.upsert({
    where: { id: 'default-rule-tree' },
    update: {},
    create: {
      id: 'default-rule-tree',
      userId: MOCK_USER_ID,
      name: 'default',
    },
  })
  console.log(`  Created rule tree: ${ruleTree.id}`)

  // 3. RuleTreeNode作成（時間帯分岐）
  console.log('Creating rule tree nodes...')

  // ルートノード
  const rootNode = await prisma.ruleTreeNode.upsert({
    where: { id: 'node-root' },
    update: {},
    create: {
      id: 'node-root',
      ruleTreeId: ruleTree.id,
      parentId: null,
      type: 'condition',
      label: '時間帯',
      condition: 'time_of_day',
      sortOrder: 0,
    },
  })

  // 時間帯別の分人ノード
  const timeNodes = [
    { id: 'node-morning', label: '朝 (6-12時)', condition: 'hour >= 6 && hour < 12', slug: 'work' },
    { id: 'node-afternoon', label: '昼 (12-18時)', condition: 'hour >= 12 && hour < 18', slug: 'creative' },
    { id: 'node-evening', label: '夕 (18-22時)', condition: 'hour >= 18 && hour < 22', slug: 'social' },
    { id: 'node-night', label: '夜 (22-6時)', condition: 'hour >= 22 || hour < 6', slug: 'rest' },
  ]

  for (let i = 0; i < timeNodes.length; i++) {
    const tn = timeNodes[i]
    // 条件ノード
    const condNode = await prisma.ruleTreeNode.upsert({
      where: { id: tn.id },
      update: {},
      create: {
        id: tn.id,
        ruleTreeId: ruleTree.id,
        parentId: rootNode.id,
        type: 'condition',
        label: tn.label,
        condition: tn.condition,
        sortOrder: i,
      },
    })

    // 分人ノード（終端）
    await prisma.ruleTreeNode.upsert({
      where: { id: `${tn.id}-bunjin` },
      update: {},
      create: {
        id: `${tn.id}-bunjin`,
        ruleTreeId: ruleTree.id,
        parentId: condNode.id,
        type: 'bunjin',
        label: tn.slug,
        bunjinSlug: tn.slug,
        sortOrder: 0,
      },
    })
  }

  // デフォルト（学習）ノード
  await prisma.ruleTreeNode.upsert({
    where: { id: 'node-default-bunjin' },
    update: {},
    create: {
      id: 'node-default-bunjin',
      ruleTreeId: ruleTree.id,
      parentId: rootNode.id,
      type: 'bunjin',
      label: 'デフォルト',
      bunjinSlug: 'learning',
      sortOrder: 99,
    },
  })

  console.log('  Created time-based rule nodes')

  // 4. PublishedVersion作成（バージョン1）
  console.log('Creating published version...')
  const allNodes = await prisma.ruleTreeNode.findMany({
    where: { ruleTreeId: ruleTree.id },
    orderBy: { sortOrder: 'asc' },
  })

  await prisma.publishedVersion.upsert({
    where: { ruleTreeId_version: { ruleTreeId: ruleTree.id, version: 1 } },
    update: {},
    create: {
      ruleTreeId: ruleTree.id,
      version: 1,
      treeJson: JSON.stringify(allNodes),
    },
  })

  console.log('  Created published version 1')
  console.log('Seeding complete!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('Seed error:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
