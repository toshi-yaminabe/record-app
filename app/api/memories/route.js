/**
 * /api/memories - メモリー一覧・作成
 */

import { NextResponse } from 'next/server'
import { errorResponse, ValidationError } from '@/lib/errors.js'
import { listMemories, createMemory } from '@/lib/services/memory-service.js'
import { prisma } from '@/lib/prisma.js'

/**
 * GET /api/memories - メモリー一覧取得
 */
export async function GET(request) {
  try {
    if (!prisma) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    if (limit < 1 || limit > 200) {
      throw new ValidationError('Limit must be between 1 and 200')
    }

    const memories = await listMemories({ limit })

    return NextResponse.json({ success: true, memories })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * POST /api/memories - 新規メモリー作成
 * Body: { text: string, bunjinId?: string, sourceRefs?: string }
 */
export async function POST(request) {
  try {
    if (!prisma) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    const body = await request.json()
    const { text, bunjinId, sourceRefs } = body

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new ValidationError('Text is required and must be a non-empty string')
    }

    if (bunjinId && typeof bunjinId !== 'string') {
      throw new ValidationError('bunjinId must be a string')
    }

    if (sourceRefs && typeof sourceRefs !== 'string') {
      throw new ValidationError('sourceRefs must be a JSON string')
    }

    const memory = await createMemory({
      text: text.trim(),
      bunjinId: bunjinId || undefined,
      sourceRefs: sourceRefs || undefined,
    })

    return NextResponse.json({ success: true, memory }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
