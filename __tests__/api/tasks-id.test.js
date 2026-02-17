import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockUpdateTaskStatus = vi.fn()

vi.mock('@/lib/services/task-service.js', () => ({
  updateTaskStatus: (...args) => mockUpdateTaskStatus(...args),
}))

vi.mock('@/lib/validators.js', () => ({
  validateBody: vi.fn((schema, body) => body),
  taskUpdateSchema: {},
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

function makeRequest({ method = 'PATCH', url = 'http://localhost/api/tasks/t1', headers = {}, body } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => body || {},
  }
}

describe('PATCH /api/tasks/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('updates task status to DOING', async () => {
    const updated = { id: 't1', title: 'Task 1', status: 'DOING' }
    mockUpdateTaskStatus.mockResolvedValue(updated)

    const { PATCH } = await import('@/app/api/tasks/[id]/route.js')
    const res = await PATCH(
      makeRequest({
        method: 'PATCH',
        body: { status: 'DOING' },
      }),
      { params: Promise.resolve({ id: 't1' }) },
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.task.status).toBe('DOING')
    expect(mockUpdateTaskStatus).toHaveBeenCalledWith('mock-user-001', 't1', 'DOING')
  })

  it('returns 400 when status is missing', async () => {
    const { PATCH } = await import('@/app/api/tasks/[id]/route.js')
    const res = await PATCH(
      makeRequest({
        method: 'PATCH',
        body: {},
      }),
      { params: Promise.resolve({ id: 't1' }) },
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
  })

  it('returns 500 when service throws unexpected error', async () => {
    mockUpdateTaskStatus.mockRejectedValue(new Error('DB error'))

    const { PATCH } = await import('@/app/api/tasks/[id]/route.js')
    const res = await PATCH(
      makeRequest({
        method: 'PATCH',
        body: { status: 'DONE' },
      }),
      { params: Promise.resolve({ id: 't1' }) },
    )

    expect(res.status).toBe(500)
    expect(res._body.success).toBe(false)
  })
})
