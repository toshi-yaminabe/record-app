import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockListBunjins = vi.fn()
const mockCreateBunjin = vi.fn()

vi.mock('@/lib/services/bunjin-service.js', () => ({
  listBunjins: (...args) => mockListBunjins(...args),
  createBunjin: (...args) => mockCreateBunjin(...args),
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

function makeRequest({ method = 'GET', url = 'http://localhost/api/bunjins', headers = {}, body } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => body || {},
  }
}

describe('GET /api/bunjins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('returns bunjins list', async () => {
    const mockData = [
      { id: 'b1', slug: 'work', displayName: 'Work Self' },
      { id: 'b2', slug: 'family', displayName: 'Family Self' },
    ]
    mockListBunjins.mockResolvedValue(mockData)

    const { GET } = await import('@/app/api/bunjins/route.js')
    const res = await GET(makeRequest(), {})

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.bunjins).toHaveLength(2)
    expect(res._body.data.bunjins[0].slug).toBe('work')
    expect(mockListBunjins).toHaveBeenCalledWith('mock-user-001')
  })

  it('returns empty array when no bunjins exist', async () => {
    mockListBunjins.mockResolvedValue([])

    const { GET } = await import('@/app/api/bunjins/route.js')
    const res = await GET(makeRequest(), {})

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.bunjins).toHaveLength(0)
  })

  it('returns 500 when service throws unexpected error', async () => {
    mockListBunjins.mockRejectedValue(new Error('DB connection failed'))

    const { GET } = await import('@/app/api/bunjins/route.js')
    const res = await GET(makeRequest(), {})

    expect(res.status).toBe(500)
    expect(res._body.success).toBe(false)
  })
})

describe('POST /api/bunjins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('creates a bunjin with valid data', async () => {
    const created = {
      id: 'b-new',
      slug: 'creative',
      displayName: 'Creative Self',
      description: 'For creative work',
      color: '#FF5500',
      icon: 'palette',
    }
    mockCreateBunjin.mockResolvedValue(created)

    const { POST } = await import('@/app/api/bunjins/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: {
          slug: 'creative',
          displayName: 'Creative Self',
          description: 'For creative work',
          color: '#FF5500',
          icon: 'palette',
        },
      }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.bunjin.slug).toBe('creative')
    expect(mockCreateBunjin).toHaveBeenCalledWith('mock-user-001', {
      slug: 'creative',
      displayName: 'Creative Self',
      description: 'For creative work',
      color: '#FF5500',
      icon: 'palette',
    })
  })

  it('creates a bunjin with minimal required fields', async () => {
    const created = { id: 'b-min', slug: 'test', displayName: 'Test' }
    mockCreateBunjin.mockResolvedValue(created)

    const { POST } = await import('@/app/api/bunjins/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: { slug: 'test', displayName: 'Test' },
      }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.bunjin.slug).toBe('test')
  })

  it('returns 400 when slug is missing', async () => {
    const { POST } = await import('@/app/api/bunjins/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: { displayName: 'No Slug' },
      }),
      {},
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
  })

  it('returns 400 when displayName is missing', async () => {
    const { POST } = await import('@/app/api/bunjins/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: { slug: 'test-slug' },
      }),
      {},
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
  })

  it('returns 400 when slug has invalid characters', async () => {
    const { POST } = await import('@/app/api/bunjins/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: { slug: 'Invalid Slug!', displayName: 'Test' },
      }),
      {},
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
  })

  it('returns 400 when color format is invalid', async () => {
    const { POST } = await import('@/app/api/bunjins/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: { slug: 'test', displayName: 'Test', color: 'red' },
      }),
      {},
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
  })

  it('returns 409 when slug already exists (Prisma P2002)', async () => {
    const p2002 = new Error('Unique constraint failed')
    p2002.code = 'P2002'
    mockCreateBunjin.mockRejectedValue(p2002)

    const { POST } = await import('@/app/api/bunjins/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: { slug: 'existing', displayName: 'Existing' },
      }),
      {},
    )

    expect(res.status).toBe(409)
    expect(res._body.success).toBe(false)
    expect(res._body.error).toBe('Resource already exists')
  })
})
