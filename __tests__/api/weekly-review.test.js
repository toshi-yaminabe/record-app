import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockGetWeeklyReview = vi.fn()
const mockCreateWeeklyExecution = vi.fn()

vi.mock('@/lib/services/weekly-service.js', () => ({
  getWeeklyReview: (...args) => mockGetWeeklyReview(...args),
  createWeeklyExecution: (...args) => mockCreateWeeklyExecution(...args),
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

function makeRequest({ method = 'GET', url = 'http://localhost/api/weekly-review', headers = {}, body } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => body || {},
  }
}

describe('GET /api/weekly-review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('returns weekly executions for given weekKey', async () => {
    const mockData = [
      { id: 'we1', weekKey: '2026-W03', proposalId: 'p1' },
    ]
    mockGetWeeklyReview.mockResolvedValue(mockData)

    const { GET } = await import('@/app/api/weekly-review/route.js')
    const res = await GET(
      makeRequest({ url: 'http://localhost/api/weekly-review?weekKey=2026-W03' }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.executions).toHaveLength(1)
    expect(mockGetWeeklyReview).toHaveBeenCalledWith('mock-user-001', '2026-W03')
  })

  it('returns 400 when weekKey is missing', async () => {
    const { GET } = await import('@/app/api/weekly-review/route.js')
    const res = await GET(makeRequest(), {})

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
    expect(res._body.error).toContain('weekKey')
  })
})

describe('POST /api/weekly-review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('creates weekly execution with valid data', async () => {
    const created = {
      id: 'we-new',
      weekKey: '2026-W03',
      proposalId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      note: 'Good week',
    }
    mockCreateWeeklyExecution.mockResolvedValue(created)

    const { POST } = await import('@/app/api/weekly-review/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: {
          weekKey: '2026-W03',
          proposalId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          note: 'Good week',
        },
      }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.execution.weekKey).toBe('2026-W03')
    expect(mockCreateWeeklyExecution).toHaveBeenCalledWith('mock-user-001', {
      weekKey: '2026-W03',
      proposalId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      note: 'Good week',
    })
  })

  it('returns 400 when weekKey format is invalid', async () => {
    const { POST } = await import('@/app/api/weekly-review/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: {
          weekKey: '2026-03',
          proposalId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
      }),
      {},
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
  })
})
