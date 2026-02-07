/**
 * 提案個別操作API
 * PATCH /api/proposals/[id] - 提案の確定/却下
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.js'
import { PROPOSAL_STATUS } from '@/lib/constants.js'
import { errorResponse, ValidationError } from '@/lib/errors.js'
import { confirmProposal, rejectProposal } from '@/lib/services/proposal-service.js'

/**
 * 提案の確定/却下
 * ボディ:
 * - status: string (必須) - "CONFIRMED" または "REJECTED"
 */
export async function PATCH(request, { params }) {
  try {
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      )
    }

    const { id } = params
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      )
    }

    if (status === PROPOSAL_STATUS.CONFIRMED) {
      const result = await confirmProposal(id)
      return NextResponse.json(result)
    } else if (status === PROPOSAL_STATUS.REJECTED) {
      const proposal = await rejectProposal(id)
      return NextResponse.json({ proposal })
    } else {
      throw new ValidationError(`Invalid status: ${status}. Must be CONFIRMED or REJECTED`)
    }
  } catch (error) {
    return errorResponse(error)
  }
}
