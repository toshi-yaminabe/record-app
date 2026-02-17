import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockGetSwlsResponse = vi.fn()
const mockUpsertSwlsResponse = vi.fn()

vi.mock('@/lib/services/swls-service.js', () => ({
  getSwlsResponse: (...args) => mockGetSwlsResponse(...args),
  upsertSwlsResponse: (...args) => mockUpsertSwlsResponse(...args),
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

function makeRequest({ method = 'GET', url = 'http://localhost/api/swls', headers = {}, body } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => body || {},
  }
}

describe('GET /api/swls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('returns SWLS response for specified dateKey', async () => {
    const mockData = { id: 's1', dateKey: '2026-01-15', q1: '5', q2: '4' }
    mockGetSwlsResponse.mockResolvedValue(mockData)

    const { GET } = await import('@/app/api/swls/route.js')
    const res = await GET(
      makeRequest({ url: 'http://localhost/api/swls?dateKey=2026-01-15' }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.response.dateKey).toBe('2026-01-15')
    expect(mockGetSwlsResponse).toHaveBeenCalledWith('mock-user-001', '2026-01-15')
  })

  it('defaults to today dateKey when not specified', async () => {
    mockGetSwlsResponse.mockResolvedValue(null)

    const { GET } = await import('@/app/api/swls/route.js')
    await GET(makeRequest(), {})

    // Should have been called with today's date key
    const callArgs = mockGetSwlsResponse.mock.calls[0]
    expect(callArgs[0]).toBe('mock-user-001')
    // dateKey should match YYYY-MM-DD pattern
    expect(callArgs[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('POST /api/swls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('creates/updates SWLS response with valid data', async () => {
    const mockResult = {
      id: 's-new',
      dateKey: '2026-01-15',
      q1: '7',
      q2: '6',
      q3: '5',
      q4: '6',
      q5: '7',
    }
    mockUpsertSwlsResponse.mockResolvedValue(mockResult)

    const { POST } = await import('@/app/api/swls/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: {
          dateKey: '2026-01-15',
          q1: '7',
          q2: '6',
          q3: '5',
          q4: '6',
          q5: '7',
        },
      }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.response.q1).toBe('7')
    expect(mockUpsertSwlsResponse).toHaveBeenCalledWith('mock-user-001', {
      dateKey: '2026-01-15',
      q1: '7',
      q2: '6',
      q3: '5',
      q4: '6',
      q5: '7',
    })
  })

  it('uses today dateKey when dateKey is omitted from body', async () => {
    mockUpsertSwlsResponse.mockResolvedValue({ id: 's2' })

    const { POST } = await import('@/app/api/swls/route.js')
    await POST(
      makeRequest({
        method: 'POST',
        body: { q1: '5' },
      }),
      {},
    )

    const callArgs = mockUpsertSwlsResponse.mock.calls[0]
    expect(callArgs[0]).toBe('mock-user-001')
    // dateKey should be today's date (YYYY-MM-DD)
    expect(callArgs[1].dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
