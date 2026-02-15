import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockCreateSession = vi.fn()
const mockListSessions = vi.fn()
const mockGetSession = vi.fn()
const mockStopSession = vi.fn()

vi.mock('@/lib/services/session-service.js', () => ({
  createSession: (...args) => mockCreateSession(...args),
  listSessions: (...args) => mockListSessions(...args),
  getSession: (...args) => mockGetSession(...args),
  stopSession: (...args) => mockStopSession(...args),
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

function makeRequest({ method = 'GET', url = 'http://localhost/api/sessions', headers = {}, body } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => body || {},
  }
}

describe('POST /api/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('creates a session with valid deviceId', async () => {
    const mockSession = {
      id: 'session-1',
      userId: 'mock-user-001',
      deviceId: 'device-abc',
      status: 'ACTIVE',
      startedAt: new Date().toISOString(),
    }
    mockCreateSession.mockResolvedValue(mockSession)

    const { POST } = await import('@/app/api/sessions/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: { deviceId: 'device-abc' },
      }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.session.id).toBe('session-1')
    expect(res._body.data.session.status).toBe('ACTIVE')
    expect(mockCreateSession).toHaveBeenCalledWith('mock-user-001', { deviceId: 'device-abc' })
  })

  it('returns 400 when deviceId is missing', async () => {
    const { POST } = await import('@/app/api/sessions/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: {},
      }),
      {},
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
    expect(res._body.error).toContain('deviceId')
  })

  it('returns 400 when deviceId is not a string', async () => {
    const { POST } = await import('@/app/api/sessions/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: { deviceId: 12345 },
      }),
      {},
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
  })
})

describe('GET /api/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('returns sessions list', async () => {
    const mockSessions = [
      { id: 's1', status: 'ACTIVE', _count: { segments: 3 } },
      { id: 's2', status: 'STOPPED', _count: { segments: 10 } },
    ]
    mockListSessions.mockResolvedValue(mockSessions)

    const { GET } = await import('@/app/api/sessions/route.js')
    const res = await GET(
      makeRequest({ url: 'http://localhost/api/sessions' }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.sessions).toHaveLength(2)
    expect(mockListSessions).toHaveBeenCalledWith('mock-user-001', { limit: 50 })
  })

  it('respects limit query parameter', async () => {
    mockListSessions.mockResolvedValue([])

    const { GET } = await import('@/app/api/sessions/route.js')
    const res = await GET(
      makeRequest({ url: 'http://localhost/api/sessions?limit=10' }),
      {},
    )

    expect(res.status).toBe(200)
    expect(mockListSessions).toHaveBeenCalledWith('mock-user-001', { limit: 10 })
  })

  it('caps limit at 200', async () => {
    mockListSessions.mockResolvedValue([])

    const { GET } = await import('@/app/api/sessions/route.js')
    await GET(
      makeRequest({ url: 'http://localhost/api/sessions?limit=999' }),
      {},
    )

    expect(mockListSessions).toHaveBeenCalledWith('mock-user-001', { limit: 200 })
  })

  it('defaults to 50 for invalid limit', async () => {
    mockListSessions.mockResolvedValue([])

    const { GET } = await import('@/app/api/sessions/route.js')
    await GET(
      makeRequest({ url: 'http://localhost/api/sessions?limit=abc' }),
      {},
    )

    expect(mockListSessions).toHaveBeenCalledWith('mock-user-001', { limit: 50 })
  })
})
