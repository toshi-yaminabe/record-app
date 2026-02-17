import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockListSegments = vi.fn()
const mockCreateSegment = vi.fn()

vi.mock('@/lib/services/segment-service.js', () => ({
  listSegments: (...args) => mockListSegments(...args),
  createSegment: (...args) => mockCreateSegment(...args),
}))

vi.mock('@/lib/validators.js', () => ({
  validateBody: vi.fn((schema, body) => body),
  segmentCreateSchema: {},
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

function makeRequest({ method = 'POST', url = 'http://localhost/api/segments', headers = {}, body } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => body || {},
  }
}

describe('POST /api/segments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('creates a segment with valid data', async () => {
    const created = {
      id: 'seg-new',
      sessionId: 'ses-1',
      segmentNo: 0,
      sttStatus: 'PENDING',
      startAt: '2026-01-15T10:00:00Z',
      endAt: '2026-01-15T10:05:00Z',
    }
    mockCreateSegment.mockResolvedValue(created)

    const { POST } = await import('@/app/api/segments/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: {
          sessionId: 'ses-1',
          segmentNo: 0,
          startAt: '2026-01-15T10:00:00Z',
          endAt: '2026-01-15T10:05:00Z',
        },
      }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.segment.id).toBe('seg-new')
    expect(res._body.data.segment.sessionId).toBe('ses-1')
    expect(mockCreateSegment).toHaveBeenCalledWith('mock-user-001', expect.objectContaining({
      sessionId: 'ses-1',
      segmentNo: 0,
    }))
  })

  it('returns 400 when sessionId is missing', async () => {
    const { POST } = await import('@/app/api/segments/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: { segmentNo: 0 },
      }),
      {},
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
    expect(res._body.error).toContain('sessionId')
  })

  it('returns 400 when segmentNo is missing', async () => {
    const { POST } = await import('@/app/api/segments/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: { sessionId: 'ses-1' },
      }),
      {},
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
    expect(res._body.error).toContain('segmentNo')
  })

  it('returns 500 when service throws unexpected error', async () => {
    mockCreateSegment.mockRejectedValue(new Error('DB error'))

    const { POST } = await import('@/app/api/segments/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: {
          sessionId: 'ses-1',
          segmentNo: 0,
        },
      }),
      {},
    )

    expect(res.status).toBe(500)
    expect(res._body.success).toBe(false)
  })
})
