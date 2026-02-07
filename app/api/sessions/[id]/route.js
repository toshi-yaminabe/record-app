/**
 * セッションAPI - 詳細取得・停止
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/errors'
import { getSession, stopSession } from '@/lib/services/session-service'

/**
 * GET /api/sessions/:id
 * セッション詳細を取得
 */
export async function GET(request, { params }) {
  try {
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      )
    }

    const { id } = await params

    const session = await getSession(id)

    return NextResponse.json(session)
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * PATCH /api/sessions/:id
 * セッションを停止
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

    const session = await stopSession(id)

    return NextResponse.json(session)
  } catch (error) {
    return errorResponse(error)
  }
}
