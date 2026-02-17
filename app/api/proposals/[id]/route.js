/**
 * PATCH /api/proposals/[id] - 提案確定/却下
 */

import { withApi } from '@/lib/middleware.js'
import { confirmProposal, rejectProposal } from '@/lib/services/proposal-service.js'
import { ValidationError } from '@/lib/errors.js'
import { validateBody, proposalUpdateSchema } from '@/lib/validators.js'

export const PATCH = withApi(async (request, { userId, params }) => {
  const { id } = params
  const body = await request.json()
  const validated = validateBody(proposalUpdateSchema, body)
  const { status } = validated

  if (status === 'CONFIRMED') {
    const result = await confirmProposal(userId, id)
    return result
  } else if (status === 'REJECTED') {
    const proposal = await rejectProposal(userId, id)
    return { proposal }
  } else {
    throw new ValidationError('status must be CONFIRMED or REJECTED')
  }
})
