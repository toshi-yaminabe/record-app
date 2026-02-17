import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockConfirmProposal = vi.fn()
const mockRejectProposal = vi.fn()

vi.mock('@/lib/services/proposal-service.js', () => ({
  confirmProposal: (...args) => mockConfirmProposal(...args),
  rejectProposal: (...args) => mockRejectProposal(...args),
}))

vi.mock('@/lib/validators.js', () => ({
  validateBody: vi.fn((schema, body) => body),
  proposalUpdateSchema: {},
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

function makeRequest({ method = 'PATCH', url = 'http://localhost/api/proposals/p1', headers = {}, body } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => body || {},
  }
}

describe('PATCH /api/proposals/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('confirms a proposal with CONFIRMED status', async () => {
    const result = { proposal: { id: 'p1', status: 'CONFIRMED' }, task: { id: 't1' } }
    mockConfirmProposal.mockResolvedValue(result)

    const { PATCH } = await import('@/app/api/proposals/[id]/route.js')
    const res = await PATCH(
      makeRequest({
        method: 'PATCH',
        body: { status: 'CONFIRMED' },
      }),
      { params: Promise.resolve({ id: 'p1' }) },
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.proposal.status).toBe('CONFIRMED')
    expect(mockConfirmProposal).toHaveBeenCalledWith('mock-user-001', 'p1')
  })

  it('rejects a proposal with REJECTED status', async () => {
    const rejected = { id: 'p1', status: 'REJECTED' }
    mockRejectProposal.mockResolvedValue(rejected)

    const { PATCH } = await import('@/app/api/proposals/[id]/route.js')
    const res = await PATCH(
      makeRequest({
        method: 'PATCH',
        body: { status: 'REJECTED' },
      }),
      { params: Promise.resolve({ id: 'p1' }) },
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.proposal.status).toBe('REJECTED')
    expect(mockRejectProposal).toHaveBeenCalledWith('mock-user-001', 'p1')
  })

  it('returns 400 for invalid status', async () => {
    const { PATCH } = await import('@/app/api/proposals/[id]/route.js')
    const res = await PATCH(
      makeRequest({
        method: 'PATCH',
        body: { status: 'INVALID' },
      }),
      { params: Promise.resolve({ id: 'p1' }) },
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
  })

  it('returns 500 when confirm fails', async () => {
    mockConfirmProposal.mockRejectedValue(new Error('DB error'))

    const { PATCH } = await import('@/app/api/proposals/[id]/route.js')
    const res = await PATCH(
      makeRequest({
        method: 'PATCH',
        body: { status: 'CONFIRMED' },
      }),
      { params: Promise.resolve({ id: 'p1' }) },
    )

    expect(res.status).toBe(500)
    expect(res._body.success).toBe(false)
  })
})
