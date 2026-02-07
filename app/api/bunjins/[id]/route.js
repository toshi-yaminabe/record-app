/**
 * PATCH  /api/bunjins/[id] - 分人更新
 * DELETE /api/bunjins/[id] - カスタム分人削除
 */

import { NextResponse } from 'next/server'
import { updateBunjin, deleteBunjin } from '@/lib/services/bunjin-service.js'
import { errorResponse } from '@/lib/errors.js'

/**
 * PATCH /api/bunjins/[id]
 * 分人を更新
 * Body: { displayName?, description?, color?, icon?, slug? }
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params
    const body = await request.json()

    const bunjin = await updateBunjin(id, body)

    return NextResponse.json({ bunjin })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * DELETE /api/bunjins/[id]
 * カスタム分人を削除（デフォルト分人は削除不可）
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params

    await deleteBunjin(id)

    return NextResponse.json({ success: true }, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
