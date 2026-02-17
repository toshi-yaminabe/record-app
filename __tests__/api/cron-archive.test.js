import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockArchiveStaleTasks = vi.fn()

vi.mock('@/lib/services/task-service.js', () => ({
  archiveStaleTasks: (...args) => mockArchiveStaleTasks(...args),
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

function makeRequest({ method = 'GET', url = 'http://localhost/api/cron/archive-tasks', headers = {} } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => ({}),
  }
}

describe('GET /api/cron/archive-tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Cron route does not use DEV_AUTH_BYPASS; it uses CRON_SECRET
    delete process.env.DEV_AUTH_BYPASS
  })

  it('returns 401 when CRON_SECRET is missing from env', async () => {
    delete process.env.CRON_SECRET

    const { GET } = await import('@/app/api/cron/archive-tasks/route.js')
    const res = await GET(makeRequest(), {})

    expect(res.status).toBe(401)
    expect(res._body.success).toBe(false)
    expect(res._body.error).toBe('Unauthorized')
  })

  it('returns 401 when Authorization header has wrong token', async () => {
    process.env.CRON_SECRET = 'correct-secret'

    const { GET } = await import('@/app/api/cron/archive-tasks/route.js')
    const res = await GET(
      makeRequest({
        headers: { authorization: 'Bearer wrong-secret' },
      }),
      {},
    )

    expect(res.status).toBe(401)
    expect(res._body.success).toBe(false)
    expect(res._body.error).toBe('Unauthorized')
  })

  it('archives stale tasks with valid CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'correct-secret'
    mockArchiveStaleTasks.mockResolvedValue({
      count: 3,
      archivedIds: ['t1', 't2', 't3'],
    })

    const { GET } = await import('@/app/api/cron/archive-tasks/route.js')
    const res = await GET(
      makeRequest({
        headers: { authorization: 'Bearer correct-secret' },
      }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.archivedCount).toBe(3)
    expect(res._body.data.archivedIds).toEqual(['t1', 't2', 't3'])
    expect(mockArchiveStaleTasks).toHaveBeenCalled()
  })
})
