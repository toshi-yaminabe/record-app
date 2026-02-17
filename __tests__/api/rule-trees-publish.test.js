import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockPublishRuleTree = vi.fn()

vi.mock('@/lib/services/rule-tree-service.js', () => ({
  publishRuleTree: (...args) => mockPublishRuleTree(...args),
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

function makeRequest({ method = 'POST', url = 'http://localhost/api/rule-trees/publish', headers = {}, body } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => body || {},
  }
}

describe('POST /api/rule-trees/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('publishes rule tree and returns published version', async () => {
    const published = {
      id: 'pv1',
      version: 1,
      snapshot: { nodes: [] },
      publishedAt: '2026-01-15T10:00:00Z',
    }
    mockPublishRuleTree.mockResolvedValue(published)

    const { POST } = await import('@/app/api/rule-trees/publish/route.js')
    const res = await POST(
      makeRequest({ method: 'POST' }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.publishedVersion.id).toBe('pv1')
    expect(res._body.data.publishedVersion.version).toBe(1)
    expect(mockPublishRuleTree).toHaveBeenCalledWith('mock-user-001')
  })

  it('returns 500 when publish fails', async () => {
    mockPublishRuleTree.mockRejectedValue(new Error('Validation failed'))

    const { POST } = await import('@/app/api/rule-trees/publish/route.js')
    const res = await POST(
      makeRequest({ method: 'POST' }),
      {},
    )

    expect(res.status).toBe(500)
    expect(res._body.success).toBe(false)
  })
})
