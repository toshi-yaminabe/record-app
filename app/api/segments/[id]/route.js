/**
 * セグメントAPI - 詳細取得・STTステータス更新
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/errors'
import { getSegment, updateSegmentSttStatus } from '@/lib/services/segment-service'

/**
 * GET /api/segments/:id
 * セグメント詳細を取得
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

    const segment = await getSegment(id)

    return NextResponse.json(segment)
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * PATCH /api/segments/:id
 * セグメントのSTTステータスを更新
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
    const { sttStatus, text } = body

    if (!sttStatus && text === undefined) {
      return NextResponse.json(
        { error: 'At least one field required: sttStatus, text' },
        { status: 400 }
      )
    }

    const segment = await updateSegmentSttStatus(id, { sttStatus, text })

    return NextResponse.json(segment)
  } catch (error) {
    return errorResponse(error)
  }
}
