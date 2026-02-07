/**
 * /api/swls - SWLS回答取得・更新
 */

import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/errors.js'
import { getSwlsResponse, upsertSwlsResponse } from '@/lib/services/swls-service.js'
import { getTodayDateKey } from '@/lib/validators.js'
import { prisma } from '@/lib/prisma.js'

/**
 * GET /api/swls?dateKey=YYYY-MM-DD - SWLS回答取得
 */
export async function GET(request) {
  try {
    if (!prisma) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const dateKey = searchParams.get('dateKey') || getTodayDateKey()

    const response = await getSwlsResponse(dateKey)

    return NextResponse.json({ success: true, response })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * POST /api/swls - SWLS回答作成/更新
 * Body: { dateKey?: string, q1?: string, q2?: string, q3?: string, q4?: string, q5?: string }
 */
export async function POST(request) {
  try {
    if (!prisma) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    const body = await request.json()
    const { dateKey = getTodayDateKey(), q1, q2, q3, q4, q5 } = body

    const response = await upsertSwlsResponse({
      dateKey,
      q1,
      q2,
      q3,
      q4,
      q5,
    })

    return NextResponse.json({ success: true, response })
  } catch (error) {
    return errorResponse(error)
  }
}
