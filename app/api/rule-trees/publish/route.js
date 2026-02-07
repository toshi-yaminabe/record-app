/**
 * POST /api/rule-trees/publish - ルールツリー検証＆公開
 */

import { NextResponse } from 'next/server'
import { publishRuleTree } from '@/lib/services/rule-tree-service.js'
import { errorResponse } from '@/lib/errors.js'

/**
 * POST /api/rule-trees/publish
 * ルールツリーを検証して公開
 * - サイクル検出
 * - 深度制限（max 10）
 * - 終端ノードがbunjinかチェック
 * - 新しい PublishedVersion を作成
 */
export async function POST() {
  try {
    const publishedVersion = await publishRuleTree()

    return NextResponse.json({
      version: publishedVersion,
    }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
