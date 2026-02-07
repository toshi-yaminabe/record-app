/**
 * 週次レビューAPI
 * GET  /api/weekly-review - 週次実行記録取得
 * POST /api/weekly-review - 週次実行記録作成
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.js'
import { errorResponse } from '@/lib/errors.js'
import { getWeeklyReview, createWeeklyExecution } from '@/lib/services/weekly-service.js'

/**
 * 週次実行記録取得
 * クエリパラメータ:
 * - weekKey: string (必須) - "YYYY-Wxx"
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
    const weekKey = searchParams.get('weekKey')

    if (!weekKey) {
      return NextResponse.json(
        { error: 'weekKey query parameter is required' },
        { status: 400 }
      )
    }

    const executions = await getWeeklyReview(weekKey)

    return NextResponse.json({ executions })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * 週次実行記録作成
 * ボディ:
 * - weekKey: string (必須) - "YYYY-Wxx"
 * - proposalId: string (必須)
 * - note: string (オプション)
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
    const { weekKey, proposalId, note } = body

    if (!weekKey || !proposalId) {
      return NextResponse.json(
        { error: 'weekKey and proposalId are required' },
        { status: 400 }
      )
    }

    const execution = await createWeeklyExecution({ weekKey, proposalId, note })

    return NextResponse.json({ execution }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
