/**
 * タスク個別操作API
 * PATCH /api/tasks/[id] - タスクステータス更新
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.js'
import { errorResponse } from '@/lib/errors.js'
import { updateTaskStatus } from '@/lib/services/task-service.js'

/**
 * タスクステータス更新
 * ボディ:
 * - status: string (必須) - 新しいステータス
 */
export async function PATCH(request, { params }) {
  try {
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      )
    }

    const task = await updateTaskStatus(id, status)

    return NextResponse.json({ task })
  } catch (error) {
    return errorResponse(error)
  }
}
