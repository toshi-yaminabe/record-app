/**
 * タスクAPI
 * GET  /api/tasks - タスク一覧取得
 * POST /api/tasks - タスク作成
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.js'
import { errorResponse } from '@/lib/errors.js'
import { listTasks, createTask } from '@/lib/services/task-service.js'

/**
 * タスク一覧取得
 * クエリパラメータ:
 * - status: タスクステータスでフィルタ (省略時はARCHIVED以外)
 * - bunjinId: 分人IDでフィルタ
 * - limit: 取得件数 (デフォルト50)
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
    const status = searchParams.get('status')
    const bunjinId = searchParams.get('bunjinId')
    const limit = searchParams.get('limit')

    const rawLimit = limit ? parseInt(limit, 10) : 50
    const safeLimit = (Number.isFinite(rawLimit) && rawLimit >= 1) ? Math.min(rawLimit, 200) : 50

    const tasks = await listTasks({
      status: status || undefined,
      bunjinId: bunjinId || undefined,
      limit: safeLimit,
    })

    return NextResponse.json({ tasks })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * タスク作成
 * ボディ:
 * - title: string (必須)
 * - body: string (オプション)
 * - bunjinId: string (オプション)
 * - priority: number (オプション、デフォルト0)
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
    const task = await createTask(body)

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
