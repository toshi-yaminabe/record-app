import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockGetRuleTree = vi.fn()
const mockReplaceRuleTree = vi.fn()

vi.mock('@/lib/services/rule-tree-service.js', () => ({
  getRuleTree: (...args) => mockGetRuleTree(...args),
  replaceRuleTree: (...args) => mockReplaceRuleTree(...args),
}))

vi.mock('@/lib/prisma.js', () => ({
  prisma: { _isMock: true },
}))

vi.mock('@/lib/supabase.js', () => ({
  getSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/rate-limit.js', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body, init) => ({
      _body: body,
      status: init?.status || 200,
      json: async () => body,
    }),
  },
}))

function makeRequest({ method = 'GET', url = 'http://localhost/api/rule-trees', headers = {}, body } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => body || {},
  }
}

describe('GET /api/rule-trees', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('returns rule tree for user', async () => {
    const mockTree = {
      id: 'rt1',
      nodes: [
        { id: 'n1', parentId: null, type: 'condition', bunjinSlug: null },
        { id: 'n2', parentId: 'n1', type: 'bunjin', bunjinSlug: 'work' },
      ],
    }
    mockGetRuleTree.mockResolvedValue(mockTree)

    const { GET } = await import('@/app/api/rule-trees/route.js')
    const res = await GET(makeRequest(), {})

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.ruleTree).toBeDefined()
    expect(mockGetRuleTree).toHaveBeenCalledWith('mock-user-001')
  })

  it('returns null when no rule tree exists', async () => {
    mockGetRuleTree.mockResolvedValue(null)

    const { GET } = await import('@/app/api/rule-trees/route.js')
    const res = await GET(makeRequest(), {})

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.ruleTree).toBeNull()
  })
})

describe('PUT /api/rule-trees', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('replaces rule tree with valid nodes', async () => {
    const newNodes = [
      { id: 'n1', parentId: null, type: 'condition', bunjinSlug: null },
      { id: 'n2', parentId: 'n1', type: 'bunjin', bunjinSlug: 'work' },
    ]
    mockReplaceRuleTree.mockResolvedValue(newNodes)

    const { PUT } = await import('@/app/api/rule-trees/route.js')
    const res = await PUT(
      makeRequest({
        method: 'PUT',
        body: { nodes: newNodes },
      }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.nodes).toHaveLength(2)
    expect(mockReplaceRuleTree).toHaveBeenCalledWith('mock-user-001', newNodes)
  })

  it('returns 400 when nodes is missing', async () => {
    const { PUT } = await import('@/app/api/rule-trees/route.js')
    const res = await PUT(
      makeRequest({
        method: 'PUT',
        body: {},
      }),
      {},
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
    expect(res._body.error).toContain('nodes')
  })

  it('returns 500 when service throws unexpected error', async () => {
    mockReplaceRuleTree.mockRejectedValue(new Error('Transaction failed'))

    const { PUT } = await import('@/app/api/rule-trees/route.js')
    const res = await PUT(
      makeRequest({
        method: 'PUT',
        body: { nodes: [{ id: 'n1', parentId: null, type: 'condition' }] },
      }),
      {},
    )

    expect(res.status).toBe(500)
    expect(res._body.success).toBe(false)
  })
})
