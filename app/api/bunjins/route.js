/**
 * GET  /api/bunjins - 全分人取得
 * POST /api/bunjins - カスタム分人作成
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.js'
import { listBunjins, createBunjin } from '@/lib/services/bunjin-service.js'
import { errorResponse } from '@/lib/errors.js'

/**
 * GET /api/bunjins
 * 全分人を取得（デフォルトが先頭）
 */
export async function GET() {
  try {
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      )
    }

    const bunjins = await listBunjins()
    return NextResponse.json({ bunjins })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * POST /api/bunjins
 * カスタム分人を作成
 * Body: { slug, displayName, description?, color?, icon? }
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
    const { slug, displayName, description, color, icon } = body

    const bunjin = await createBunjin({
      slug,
      displayName,
      description,
      color,
      icon,
    })

    return NextResponse.json({ bunjin }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
