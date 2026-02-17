import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockListProposals = vi.fn()
const mockGenerateDailyProposals = vi.fn()

vi.mock('@/lib/services/proposal-service.js', () => ({
  listProposals: (...args) => mockListProposals(...args),
  generateDailyProposals: (...args) => mockGenerateDailyProposals(...args),
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

function makeRequest({ method = 'GET', url = 'http://localhost/api/proposals', headers = {}, body } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => body || {},
  }
}

describe('GET /api/proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('returns proposals list without filters', async () => {
    const mockData = [
      { id: 'p1', type: 'SUMMARY', status: 'PENDING' },
      { id: 'p2', type: 'TASK', status: 'CONFIRMED' },
    ]
    mockListProposals.mockResolvedValue(mockData)

    const { GET } = await import('@/app/api/proposals/route.js')
    const res = await GET(makeRequest(), {})

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.proposals).toHaveLength(2)
    expect(mockListProposals).toHaveBeenCalledWith('mock-user-001', {
      dateKey: undefined,
      status: undefined,
    })
  })

  it('filters by dateKey and status', async () => {
    mockListProposals.mockResolvedValue([])

    const { GET } = await import('@/app/api/proposals/route.js')
    await GET(
      makeRequest({ url: 'http://localhost/api/proposals?dateKey=2026-01-15&status=PENDING' }),
      {},
    )

    expect(mockListProposals).toHaveBeenCalledWith('mock-user-001', {
      dateKey: '2026-01-15',
      status: 'PENDING',
    })
  })
})

describe('POST /api/proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('generates daily proposals with valid dateKey', async () => {
    const generated = [
      { id: 'p-new-1', type: 'SUMMARY', dateKey: '2026-01-15' },
      { id: 'p-new-2', type: 'TASK', dateKey: '2026-01-15' },
    ]
    mockGenerateDailyProposals.mockResolvedValue(generated)

    const { POST } = await import('@/app/api/proposals/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: { dateKey: '2026-01-15' },
      }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.proposals).toHaveLength(2)
    expect(mockGenerateDailyProposals).toHaveBeenCalledWith('mock-user-001', '2026-01-15')
  })

  it('returns 400 when dateKey is missing', async () => {
    const { POST } = await import('@/app/api/proposals/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: {},
      }),
      {},
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
  })

  it('returns 400 when dateKey format is invalid', async () => {
    const { POST } = await import('@/app/api/proposals/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: { dateKey: '2026/01/15' },
      }),
      {},
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
  })

  it('returns 500 when generation fails', async () => {
    mockGenerateDailyProposals.mockRejectedValue(new Error('Gemini API error'))

    const { POST } = await import('@/app/api/proposals/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: { dateKey: '2026-01-15' },
      }),
      {},
    )

    expect(res.status).toBe(500)
    expect(res._body.success).toBe(false)
  })
})
