import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockGetSegment = vi.fn()
const mockUpdateSegmentSttStatus = vi.fn()

vi.mock('@/lib/services/segment-service', () => ({
  getSegment: (...args) => mockGetSegment(...args),
  updateSegmentSttStatus: (...args) => mockUpdateSegmentSttStatus(...args),
}))

vi.mock('@/lib/validators.js', () => ({
  validateBody: vi.fn((schema, body) => body),
  segmentUpdateSchema: {},
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

function makeRequest({ method = 'GET', url = 'http://localhost/api/segments/seg1', headers = {}, body } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => body || {},
  }
}

describe('GET /api/segments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('returns segment data', async () => {
    const mockSegment = {
      id: 'seg1',
      segmentNo: 0,
      sttStatus: 'DONE',
      text: 'Hello world',
    }
    mockGetSegment.mockResolvedValue(mockSegment)

    const { GET } = await import('@/app/api/segments/[id]/route.js')
    const res = await GET(
      makeRequest(),
      { params: Promise.resolve({ id: 'seg1' }) },
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.id).toBe('seg1')
    expect(res._body.data.sttStatus).toBe('DONE')
    expect(mockGetSegment).toHaveBeenCalledWith('mock-user-001', 'seg1')
  })

  it('returns 500 when service throws unexpected error', async () => {
    mockGetSegment.mockRejectedValue(new Error('DB error'))

    const { GET } = await import('@/app/api/segments/[id]/route.js')
    const res = await GET(
      makeRequest(),
      { params: Promise.resolve({ id: 'seg1' }) },
    )

    expect(res.status).toBe(500)
    expect(res._body.success).toBe(false)
  })
})

describe('PATCH /api/segments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('updates segment sttStatus', async () => {
    const updated = { id: 'seg1', segmentNo: 0, sttStatus: 'DONE', text: 'Transcribed text' }
    mockUpdateSegmentSttStatus.mockResolvedValue(updated)

    const { PATCH } = await import('@/app/api/segments/[id]/route.js')
    const res = await PATCH(
      makeRequest({
        method: 'PATCH',
        body: { sttStatus: 'DONE' },
      }),
      { params: Promise.resolve({ id: 'seg1' }) },
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.sttStatus).toBe('DONE')
    expect(mockUpdateSegmentSttStatus).toHaveBeenCalledWith('mock-user-001', 'seg1', {
      sttStatus: 'DONE',
      text: undefined,
    })
  })

  it('updates segment with text', async () => {
    const updated = { id: 'seg1', segmentNo: 0, sttStatus: 'DONE', text: 'New text' }
    mockUpdateSegmentSttStatus.mockResolvedValue(updated)

    const { PATCH } = await import('@/app/api/segments/[id]/route.js')
    const res = await PATCH(
      makeRequest({
        method: 'PATCH',
        body: { sttStatus: 'DONE', text: 'New text' },
      }),
      { params: Promise.resolve({ id: 'seg1' }) },
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(mockUpdateSegmentSttStatus).toHaveBeenCalledWith('mock-user-001', 'seg1', {
      sttStatus: 'DONE',
      text: 'New text',
    })
  })

  it('returns 400 when no fields provided', async () => {
    const { PATCH } = await import('@/app/api/segments/[id]/route.js')
    const res = await PATCH(
      makeRequest({
        method: 'PATCH',
        body: {},
      }),
      { params: Promise.resolve({ id: 'seg1' }) },
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
  })

  it('returns 500 when service throws unexpected error', async () => {
    mockUpdateSegmentSttStatus.mockRejectedValue(new Error('DB error'))

    const { PATCH } = await import('@/app/api/segments/[id]/route.js')
    const res = await PATCH(
      makeRequest({
        method: 'PATCH',
        body: { sttStatus: 'FAILED' },
      }),
      { params: Promise.resolve({ id: 'seg1' }) },
    )

    expect(res.status).toBe(500)
    expect(res._body.success).toBe(false)
  })
})
