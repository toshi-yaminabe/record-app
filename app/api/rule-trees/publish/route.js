/**
 * POST /api/rule-trees/publish - ルールツリー検証＆公開
 */

import { withApi } from '@/lib/middleware.js'
import { publishRuleTree } from '@/lib/services/rule-tree-service.js'

export const POST = withApi(async (request, { userId }) => {
  const publishedVersion = await publishRuleTree(userId)
  return { publishedVersion }
})
