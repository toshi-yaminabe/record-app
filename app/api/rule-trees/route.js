/**
 * GET /api/rule-trees - ルールツリー取得
 * PUT /api/rule-trees - ドラフトツリー全置換
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.js'
import { getRuleTree, replaceRuleTree } from '@/lib/services/rule-tree-service.js'
import { errorResponse } from '@/lib/errors.js'

/**
 * GET /api/rule-trees
 * ルールツリーと全ノードを取得
 */
export async function GET() {
  try {
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      )
    }

    const tree = await getRuleTree()
    return NextResponse.json(tree)
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * PUT /api/rule-trees
 * ドラフトツリーを全置換
 * Body: { nodes: [{ parentId?, type, label?, condition?, bunjinSlug?, sortOrder }] }
 */
export async function PUT(request) {
  try {
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { nodes } = body

    if (!nodes) {
      return NextResponse.json(
        { error: 'nodes array is required' },
        { status: 400 }
      )
    }

    const newNodes = await replaceRuleTree(nodes)

    return NextResponse.json({ nodes: newNodes })
  } catch (error) {
    return errorResponse(error)
  }
}
