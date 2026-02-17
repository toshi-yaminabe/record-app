import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetDailyKpi = vi.fn()
const mockGetWeeklyKpi = vi.fn()

vi.mock('@/lib/services/kpi-service.js', () => ({
  getDailyKpi: (...args) => mockGetDailyKpi(...args),
  getWeeklyKpi: (...args) => mockGetWeeklyKpi(...args),
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

function makeRequest({ url }) {
  return {
    method: 'GET',
    url,
    headers: new Headers(),
  }
}

describe('GET /api/kpi/daily', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('有効な日付キーで日次KPIを返す', async () => {
    mockGetDailyKpi.mockResolvedValue({
      dateKey: '2026-02-17',
      server: 10,
      local: 5,
      total: 15,
      localRatio: 1 / 3,
    })

    const { GET } = await import('@/app/api/kpi/daily/route.js')
    const res = await GET(
      makeRequest({ url: 'http://localhost/api/kpi/daily?dateKey=2026-02-17' }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.kpi.server).toBe(10)
    expect(res._body.data.kpi.local).toBe(5)
  })

  it('dateKey 未指定時は今日の日付を使う', async () => {
    mockGetDailyKpi.mockResolvedValue({
      dateKey: '2026-02-17',
      server: 0,
      local: 0,
      total: 0,
      localRatio: 0,
    })

    const { GET } = await import('@/app/api/kpi/daily/route.js')
    const res = await GET(
      makeRequest({ url: 'http://localhost/api/kpi/daily' }),
      {},
    )

    expect(res.status).toBe(200)
    expect(mockGetDailyKpi).toHaveBeenCalledWith('mock-user-001', expect.any(String))
  })
})

describe('GET /api/kpi/weekly', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('有効な週キーで週次KPIを返す', async () => {
    mockGetWeeklyKpi.mockResolvedValue({
      weekKey: '2026-W08',
      server: 50,
      local: 30,
      total: 80,
      localRatio: 30 / 80,
    })

    const { GET } = await import('@/app/api/kpi/weekly/route.js')
    const res = await GET(
      makeRequest({ url: 'http://localhost/api/kpi/weekly?weekKey=2026-W08' }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.kpi.server).toBe(50)
    expect(res._body.data.kpi.local).toBe(30)
  })

  it('weekKey 未指定時はエラーを返す', async () => {
    const { GET } = await import('@/app/api/kpi/weekly/route.js')
    const res = await GET(
      makeRequest({ url: 'http://localhost/api/kpi/weekly' }),
      {},
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
  })
})
