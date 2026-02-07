/**
 * /api/memories/[id] - メモリー更新
 */

import { NextResponse } from 'next/server'
import { errorResponse, ValidationError } from '@/lib/errors.js'
import { updateMemoryText } from '@/lib/services/memory-service.js'
import { prisma } from '@/lib/prisma.js'

/**
 * PATCH /api/memories/[id] - メモリーテキスト更新
 * Body: { text: string }
 */
export async function PATCH(request, { params }) {
  try {
    if (!prisma) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    const { id } = await params
    const body = await request.json()
    const { text } = body

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new ValidationError('Text is required and must be a non-empty string')
    }

    const memory = await updateMemoryText(id, text.trim())

    return NextResponse.json({ success: true, memory })
  } catch (error) {
    return errorResponse(error)
  }
}
