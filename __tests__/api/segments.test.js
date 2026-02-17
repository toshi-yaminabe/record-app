import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockListSegments = vi.fn()
const mockCreateSegment = vi.fn()

vi.mock('@/lib/services/segment-service.js', () => ({
  listSegments: (...args) => mockListSegments(...args),
  createSegment: (...args) => mockCreateSegment(...args),
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

function makeRequest({ method = 'GET', url = 'http://localhost/api/segments', headers = {}, body } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => body || {},
  }
}

describe('GET /api/segments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('returns segments list with default limit', async () => {
    const mockData = [
      { id: 'seg1', segmentNo: 0, sttStatus: 'DONE' },
      { id: 'seg2', segmentNo: 1, sttStatus: 'PENDING' },
    ]
    mockListSegments.mockResolvedValue(mockData)

    const { GET } = await import('@/app/api/segments/route.js')
    const res = await GET(makeRequest(), {})

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.segments).toHaveLength(2)
    expect(mockListSegments).toHaveBeenCalledWith('mock-user-001', {
      sessionId: null,
      limit: 100,
    })
  })

  it('filters by sessionId query parameter', async () => {
    mockListSegments.mockResolvedValue([])

    const { GET } = await import('@/app/api/segments/route.js')
    await GET(
      makeRequest({ url: 'http://localhost/api/segments?sessionId=ses-abc' }),
      {},
    )

    expect(mockListSegments).toHaveBeenCalledWith('mock-user-001', {
      sessionId: 'ses-abc',
      limit: 100,
    })
  })

  it('respects custom limit', async () => {
    mockListSegments.mockResolvedValue([])

    const { GET } = await import('@/app/api/segments/route.js')
    await GET(
      makeRequest({ url: 'http://localhost/api/segments?limit=20' }),
      {},
    )

    expect(mockListSegments).toHaveBeenCalledWith('mock-user-001', {
      sessionId: null,
      limit: 20,
    })
  })

  it('caps limit at 200', async () => {
    mockListSegments.mockResolvedValue([])

    const { GET } = await import('@/app/api/segments/route.js')
    await GET(
      makeRequest({ url: 'http://localhost/api/segments?limit=500' }),
      {},
    )

    expect(mockListSegments).toHaveBeenCalledWith('mock-user-001', {
      sessionId: null,
      limit: 200,
    })
  })

  it('defaults to 100 for invalid limit', async () => {
    mockListSegments.mockResolvedValue([])

    const { GET } = await import('@/app/api/segments/route.js')
    await GET(
      makeRequest({ url: 'http://localhost/api/segments?limit=xyz' }),
      {},
    )

    expect(mockListSegments).toHaveBeenCalledWith('mock-user-001', {
      sessionId: null,
      limit: 100,
    })
  })
})
