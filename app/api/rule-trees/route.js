/**
 * GET /api/rule-trees - ルールツリー取得
 * PUT /api/rule-trees - ドラフトツリー全置換
 */

import { withApi } from '@/lib/middleware.js'
import { getRuleTree, replaceRuleTree } from '@/lib/services/rule-tree-service.js'
import { validateBody, ruleTreeUpdateSchema } from '@/lib/validators.js'

export const GET = withApi(async (request, { userId }) => {
  const ruleTree = await getRuleTree(userId)
  return { ruleTree }
})

export const PUT = withApi(async (request, { userId }) => {
  const body = await request.json()
  const validated = validateBody(ruleTreeUpdateSchema, body)
  const { nodes } = validated

  const newNodes = await replaceRuleTree(userId, nodes)
  return { nodes: newNodes }
})
