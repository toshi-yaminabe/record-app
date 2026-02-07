/**
 * セグメントAPI - 一覧取得
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/errors'
import { listSegments } from '@/lib/services/segment-service'

/**
 * GET /api/segments
 * セグメント一覧を取得
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
    const sessionId = searchParams.get('sessionId')
    const rawLimit = parseInt(searchParams.get('limit') || '100', 10)
    const limit = (Number.isFinite(rawLimit) && rawLimit >= 1) ? Math.min(rawLimit, 200) : 100

    const segments = await listSegments({ sessionId, limit })

    return NextResponse.json({ segments })
  } catch (error) {
    return errorResponse(error)
  }
}
