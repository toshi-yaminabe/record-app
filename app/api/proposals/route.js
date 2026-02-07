/**
 * 提案API
 * GET  /api/proposals - 提案一覧取得
 * POST /api/proposals - 日次提案生成
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.js'
import { errorResponse } from '@/lib/errors.js'
import { listProposals, generateDailyProposals } from '@/lib/services/proposal-service.js'

/**
 * 提案一覧取得
 * クエリパラメータ:
 * - dateKey: 日付キー (YYYY-MM-DD)
 * - status: 提案ステータス (PENDING/CONFIRMED/REJECTED)
 */
export async function GET(request) {
  try {
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      )
    }

    const { searchParams } = new URL(request.url)
    const dateKey = searchParams.get('dateKey')
    const status = searchParams.get('status')

    const proposals = await listProposals({
      dateKey: dateKey || undefined,
      status: status || undefined,
    })

    return NextResponse.json({ proposals })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * 日次提案生成
 * ボディ:
 * - dateKey: string (必須) - "YYYY-MM-DD"
 */
export async function POST(request) {
  try {
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { dateKey } = body

    if (!dateKey) {
      return NextResponse.json(
        { error: 'dateKey is required' },
        { status: 400 }
      )
    }

    const proposals = await generateDailyProposals(dateKey)

    return NextResponse.json({ proposals }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
