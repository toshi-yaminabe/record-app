import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockUpdateMemoryText = vi.fn()

vi.mock('@/lib/services/memory-service.js', () => ({
  updateMemoryText: (...args) => mockUpdateMemoryText(...args),
}))

vi.mock('@/lib/validators.js', () => ({
  validateBody: vi.fn((schema, body) => body),
  memoryUpdateSchema: {},
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

function makeRequest({ method = 'PATCH', url = 'http://localhost/api/memories/m1', headers = {}, body } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => body || {},
  }
}

describe('PATCH /api/memories/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('updates memory text with valid text', async () => {
    const updated = { id: 'm1', text: 'Updated memory text' }
    mockUpdateMemoryText.mockResolvedValue(updated)

    const { PATCH } = await import('@/app/api/memories/[id]/route.js')
    const res = await PATCH(
      makeRequest({
        method: 'PATCH',
        body: { text: 'Updated memory text' },
      }),
      { params: Promise.resolve({ id: 'm1' }) },
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.memory.text).toBe('Updated memory text')
    expect(mockUpdateMemoryText).toHaveBeenCalledWith('mock-user-001', 'm1', 'Updated memory text')
  })

  it('returns 400 when text is empty string', async () => {
    const { PATCH } = await import('@/app/api/memories/[id]/route.js')
    const res = await PATCH(
      makeRequest({
        method: 'PATCH',
        body: { text: '' },
      }),
      { params: Promise.resolve({ id: 'm1' }) },
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
  })

  it('returns 400 when text is whitespace only', async () => {
    const { PATCH } = await import('@/app/api/memories/[id]/route.js')
    const res = await PATCH(
      makeRequest({
        method: 'PATCH',
        body: { text: '   ' },
      }),
      { params: Promise.resolve({ id: 'm1' }) },
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
  })

  it('returns 400 when text is missing', async () => {
    const { PATCH } = await import('@/app/api/memories/[id]/route.js')
    const res = await PATCH(
      makeRequest({
        method: 'PATCH',
        body: {},
      }),
      { params: Promise.resolve({ id: 'm1' }) },
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
  })

  it('returns 500 when service throws unexpected error', async () => {
    mockUpdateMemoryText.mockRejectedValue(new Error('DB error'))

    const { PATCH } = await import('@/app/api/memories/[id]/route.js')
    const res = await PATCH(
      makeRequest({
        method: 'PATCH',
        body: { text: 'Valid text' },
      }),
      { params: Promise.resolve({ id: 'm1' }) },
    )

    expect(res.status).toBe(500)
    expect(res._body.success).toBe(false)
  })
})
