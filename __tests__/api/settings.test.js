import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockFindUnique = vi.fn()
const mockUpsert = vi.fn()

vi.mock('@/lib/prisma.js', () => ({
  prisma: {
    _isMock: true,
    userSettings: {
      findUnique: (...args) => mockFindUnique(...args),
      upsert: (...args) => mockUpsert(...args),
    },
  },
}))

vi.mock('@/lib/crypto.js', () => ({
  encrypt: vi.fn((value) => `encrypted:${value}`),
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

function makeRequest({ method = 'GET', url = 'http://localhost/api/settings', headers = {}, body } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => body || {},
  }
}

describe('GET /api/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('returns settings with hasGeminiApiKey true when key exists', async () => {
    mockFindUnique.mockResolvedValue({
      geminiApiKey: 'encrypted-key-data',
      updatedAt: '2026-01-15T00:00:00Z',
    })

    const { GET } = await import('@/app/api/settings/route.js')
    const res = await GET(makeRequest(), {})

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.settings.hasGeminiApiKey).toBe(true)
    expect(res._body.data.settings.updatedAt).toBe('2026-01-15T00:00:00Z')
  })

  it('returns settings with hasGeminiApiKey false when no settings', async () => {
    mockFindUnique.mockResolvedValue(null)

    const { GET } = await import('@/app/api/settings/route.js')
    const res = await GET(makeRequest(), {})

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.settings.hasGeminiApiKey).toBe(false)
    expect(res._body.data.settings.updatedAt).toBeNull()
  })
})

describe('PUT /api/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('updates geminiApiKey successfully', async () => {
    mockUpsert.mockResolvedValue({
      geminiApiKey: 'encrypted:AIzaSy1234567890',
      updatedAt: '2026-01-15T12:00:00Z',
    })

    const { PUT } = await import('@/app/api/settings/route.js')
    const res = await PUT(
      makeRequest({
        method: 'PUT',
        body: { geminiApiKey: 'AIzaSy1234567890' },
      }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.settings.hasGeminiApiKey).toBe(true)
  })

  it('returns 400 when geminiApiKey is too short', async () => {
    const { PUT } = await import('@/app/api/settings/route.js')
    const res = await PUT(
      makeRequest({
        method: 'PUT',
        body: { geminiApiKey: 'short' },
      }),
      {},
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
  })
})

describe('DELETE /api/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('deletes API key and returns deleted: true', async () => {
    mockUpsert.mockResolvedValue({ geminiApiKey: null })

    const { DELETE } = await import('@/app/api/settings/route.js')
    const res = await DELETE(makeRequest({ method: 'DELETE' }), {})

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.deleted).toBe(true)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'mock-user-001' },
        update: { geminiApiKey: null },
      }),
    )
  })
})
