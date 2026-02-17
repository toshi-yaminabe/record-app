import { describe, it, expect, vi, beforeEach } from 'vitest'

const queryRawMock = vi.fn()

vi.mock('@/lib/prisma.js', () => ({
  prisma: {
    $queryRaw: (...args) => queryRawMock(...args),
  },
}))

vi.mock('@/lib/gemini.js', () => ({
  isGeminiAvailableAsync: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
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

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns healthy status when DB and Gemini are OK', async () => {
    queryRawMock.mockResolvedValue([{ '?column?': 1 }])

    const { GET } = await import('@/app/api/health/route.js')
    const res = await GET()

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.ok).toBe(true)
    expect(res._body.data.database).toBe(true)
    expect(res._body.data.gemini).toBe(true)
  })

  it('returns database false when DB query fails', async () => {
    queryRawMock.mockRejectedValue(new Error('Connection refused'))

    const { GET } = await import('@/app/api/health/route.js')
    const res = await GET()

    expect(res.status).toBe(200)
    expect(res._body.data.database).toBe(false)
    expect(res._body.data.ok).toBe(false)
  })

  it('includes version in response', async () => {
    queryRawMock.mockResolvedValue([])

    const { GET } = await import('@/app/api/health/route.js')
    const res = await GET()

    expect(res._body.data).toHaveProperty('version')
  })
})
