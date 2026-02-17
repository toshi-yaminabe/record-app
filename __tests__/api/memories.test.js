import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockListMemories = vi.fn()
const mockCreateMemory = vi.fn()

vi.mock('@/lib/services/memory-service.js', () => ({
  listMemories: (...args) => mockListMemories(...args),
  createMemory: (...args) => mockCreateMemory(...args),
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

function makeRequest({ method = 'GET', url = 'http://localhost/api/memories', headers = {}, body } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => body || {},
  }
}

describe('GET /api/memories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('returns memories list with default limit', async () => {
    const mockData = [
      { id: 'm1', text: 'Memory one' },
      { id: 'm2', text: 'Memory two' },
    ]
    mockListMemories.mockResolvedValue(mockData)

    const { GET } = await import('@/app/api/memories/route.js')
    const res = await GET(makeRequest(), {})

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.memories).toHaveLength(2)
    expect(mockListMemories).toHaveBeenCalledWith('mock-user-001', { limit: 50 })
  })

  it('respects custom limit', async () => {
    mockListMemories.mockResolvedValue([])

    const { GET } = await import('@/app/api/memories/route.js')
    await GET(
      makeRequest({ url: 'http://localhost/api/memories?limit=25' }),
      {},
    )

    expect(mockListMemories).toHaveBeenCalledWith('mock-user-001', { limit: 25 })
  })

  it('returns 400 for limit exceeding 200', async () => {
    const { GET } = await import('@/app/api/memories/route.js')
    const res = await GET(
      makeRequest({ url: 'http://localhost/api/memories?limit=300' }),
      {},
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
    expect(res._body.error).toContain('limit')
  })
})

describe('POST /api/memories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('creates a memory with valid text', async () => {
    const created = { id: 'm-new', text: 'A new memory', bunjinId: null }
    mockCreateMemory.mockResolvedValue(created)

    const { POST } = await import('@/app/api/memories/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: { text: 'A new memory' },
      }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.memory.text).toBe('A new memory')
    expect(mockCreateMemory).toHaveBeenCalledWith('mock-user-001', {
      text: 'A new memory',
      bunjinId: undefined,
      sourceRefs: undefined,
    })
  })

  it('returns 400 when text is empty', async () => {
    const { POST } = await import('@/app/api/memories/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: { text: '' },
      }),
      {},
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
  })
})
