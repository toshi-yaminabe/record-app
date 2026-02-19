import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockGetMemory = vi.fn()

vi.mock('@/lib/services/memory-service.js', () => ({
  getMemory: (...args) => mockGetMemory(...args),
}))

vi.mock('@/lib/prisma.js', () => ({
  prisma: { _isMock: true },
}))

vi.mock('@/lib/supabase.js', () => ({
  getSupabaseAdmin: vi.fn(),
  getSupabaseAuthClient: vi.fn(),
  getSupabaseAuthConfigStatus: vi.fn(() => ({ ok: true })),
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

function makeRequest({ method = 'GET', url = 'http://localhost/api/memories/m1', headers = {} } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => ({}),
  }
}

describe('GET /api/memories/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('returns memory by id', async () => {
    const memory = { id: 'm1', text: 'Test memory', userId: 'mock-user-001' }
    mockGetMemory.mockResolvedValue(memory)

    const { GET } = await import('@/app/api/memories/[id]/route.js')
    const res = await GET(
      makeRequest(),
      { params: Promise.resolve({ id: 'm1' }) },
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.memory.id).toBe('m1')
    expect(mockGetMemory).toHaveBeenCalledWith('mock-user-001', 'm1')
  })

  it('returns 500 when service throws unexpected error', async () => {
    mockGetMemory.mockRejectedValue(new Error('DB error'))

    const { GET } = await import('@/app/api/memories/[id]/route.js')
    const res = await GET(
      makeRequest(),
      { params: Promise.resolve({ id: 'm1' }) },
    )

    expect(res.status).toBe(500)
    expect(res._body.success).toBe(false)
  })
})
