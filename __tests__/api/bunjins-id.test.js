import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockUpdateBunjin = vi.fn()
const mockDeleteBunjin = vi.fn()

vi.mock('@/lib/services/bunjin-service.js', () => ({
  updateBunjin: (...args) => mockUpdateBunjin(...args),
  deleteBunjin: (...args) => mockDeleteBunjin(...args),
}))

vi.mock('@/lib/validators.js', () => ({
  validateBody: vi.fn((schema, body) => body),
  bunjinUpdateSchema: {},
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

function makeRequest({ method = 'PATCH', url = 'http://localhost/api/bunjins/b1', headers = {}, body } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => body || {},
  }
}

describe('PATCH /api/bunjins/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('updates a bunjin with valid displayName', async () => {
    const updated = { id: 'b1', slug: 'work', displayName: 'Updated Work' }
    mockUpdateBunjin.mockResolvedValue(updated)

    const { PATCH } = await import('@/app/api/bunjins/[id]/route.js')
    const res = await PATCH(
      makeRequest({
        method: 'PATCH',
        body: { displayName: 'Updated Work' },
      }),
      { params: Promise.resolve({ id: 'b1' }) },
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.bunjin.displayName).toBe('Updated Work')
    expect(mockUpdateBunjin).toHaveBeenCalledWith('mock-user-001', 'b1', { displayName: 'Updated Work' })
  })

  it('returns 500 when service throws unexpected error', async () => {
    mockUpdateBunjin.mockRejectedValue(new Error('DB error'))

    const { PATCH } = await import('@/app/api/bunjins/[id]/route.js')
    const res = await PATCH(
      makeRequest({
        method: 'PATCH',
        body: { displayName: 'Fail' },
      }),
      { params: Promise.resolve({ id: 'b1' }) },
    )

    expect(res.status).toBe(500)
    expect(res._body.success).toBe(false)
  })
})

describe('DELETE /api/bunjins/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('deletes a bunjin and returns null data', async () => {
    mockDeleteBunjin.mockResolvedValue(undefined)

    const { DELETE } = await import('@/app/api/bunjins/[id]/route.js')
    const res = await DELETE(
      makeRequest({ method: 'DELETE' }),
      { params: Promise.resolve({ id: 'b1' }) },
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data).toBeNull()
    expect(mockDeleteBunjin).toHaveBeenCalledWith('mock-user-001', 'b1')
  })

  it('returns 500 when delete fails', async () => {
    mockDeleteBunjin.mockRejectedValue(new Error('Cannot delete default bunjin'))

    const { DELETE } = await import('@/app/api/bunjins/[id]/route.js')
    const res = await DELETE(
      makeRequest({ method: 'DELETE' }),
      { params: Promise.resolve({ id: 'b1' }) },
    )

    expect(res.status).toBe(500)
    expect(res._body.success).toBe(false)
  })
})
