/**
 * セッションAPI - 一覧取得・作成
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/errors'
import { createSession, listSessions } from '@/lib/services/session-service'

/**
 * POST /api/sessions
 * 新しいセッションを作成
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
    const { deviceId } = body

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Missing required field: deviceId' },
        { status: 400 }
      )
    }

    const session = await createSession({ deviceId })

    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * GET /api/sessions
 * セッション一覧を取得
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
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10)
    const limit = (Number.isFinite(rawLimit) && rawLimit >= 1) ? Math.min(rawLimit, 200) : 50

    const sessions = await listSessions({ limit })

    return NextResponse.json({ sessions })
  } catch (error) {
    return errorResponse(error)
  }
}
