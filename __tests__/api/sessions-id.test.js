import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockGetSession = vi.fn()
const mockStopSession = vi.fn()

vi.mock('@/lib/services/session-service.js', () => ({
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

function makeRequest({ method = 'GET', url = 'http://localhost/api/sessions/s1', headers = {}, body } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => body || {},
  }
}

describe('GET /api/sessions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('returns session data', async () => {
    const mockSession = {
      id: 's1',
      userId: 'mock-user-001',
      status: 'ACTIVE',
      startedAt: '2026-01-15T10:00:00Z',
    }
    mockGetSession.mockResolvedValue(mockSession)

    const { GET } = await import('@/app/api/sessions/[id]/route.js')
    const res = await GET(
      makeRequest(),
      { params: Promise.resolve({ id: 's1' }) },
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.session.id).toBe('s1')
    expect(res._body.data.session.status).toBe('ACTIVE')
    expect(mockGetSession).toHaveBeenCalledWith('mock-user-001', 's1')
  })

  it('returns 500 when service throws unexpected error', async () => {
    mockGetSession.mockRejectedValue(new Error('DB error'))

    const { GET } = await import('@/app/api/sessions/[id]/route.js')
    const res = await GET(
      makeRequest(),
      { params: Promise.resolve({ id: 's1' }) },
    )

    expect(res.status).toBe(500)
    expect(res._body.success).toBe(false)
  })
})

describe('PATCH /api/sessions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('stops a session and returns stopped session', async () => {
    const stoppedSession = {
      id: 's1',
      userId: 'mock-user-001',
      status: 'STOPPED',
      startedAt: '2026-01-15T10:00:00Z',
      stoppedAt: '2026-01-15T11:00:00Z',
    }
    mockStopSession.mockResolvedValue(stoppedSession)

    const { PATCH } = await import('@/app/api/sessions/[id]/route.js')
    const res = await PATCH(
      makeRequest({ method: 'PATCH' }),
      { params: Promise.resolve({ id: 's1' }) },
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.session.status).toBe('STOPPED')
    expect(mockStopSession).toHaveBeenCalledWith('mock-user-001', 's1')
  })

  it('returns 500 when stop fails', async () => {
    mockStopSession.mockRejectedValue(new Error('Session already stopped'))

    const { PATCH } = await import('@/app/api/sessions/[id]/route.js')
    const res = await PATCH(
      makeRequest({ method: 'PATCH' }),
      { params: Promise.resolve({ id: 's1' }) },
    )

    expect(res.status).toBe(500)
    expect(res._body.success).toBe(false)
  })
})
