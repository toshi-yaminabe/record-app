import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockListTasks = vi.fn()
const mockCreateTask = vi.fn()

vi.mock('@/lib/services/task-service.js', () => ({
  listTasks: (...args) => mockListTasks(...args),
  createTask: (...args) => mockCreateTask(...args),
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

function makeRequest({ method = 'GET', url = 'http://localhost/api/tasks', headers = {}, body } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => body || {},
  }
}

describe('GET /api/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('returns tasks list with default limit', async () => {
    const mockData = [
      { id: 't1', title: 'Task 1', status: 'TODO' },
      { id: 't2', title: 'Task 2', status: 'DOING' },
    ]
    mockListTasks.mockResolvedValue(mockData)

    const { GET } = await import('@/app/api/tasks/route.js')
    const res = await GET(makeRequest(), {})

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.tasks).toHaveLength(2)
    expect(mockListTasks).toHaveBeenCalledWith('mock-user-001', {
      status: undefined,
      bunjinId: undefined,
      limit: 50,
    })
  })

  it('filters by status query parameter', async () => {
    mockListTasks.mockResolvedValue([])

    const { GET } = await import('@/app/api/tasks/route.js')
    await GET(makeRequest({ url: 'http://localhost/api/tasks?status=TODO' }), {})

    expect(mockListTasks).toHaveBeenCalledWith('mock-user-001', {
      status: 'TODO',
      bunjinId: undefined,
      limit: 50,
    })
  })

  it('filters by bunjinId query parameter', async () => {
    mockListTasks.mockResolvedValue([])

    const { GET } = await import('@/app/api/tasks/route.js')
    await GET(makeRequest({ url: 'http://localhost/api/tasks?bunjinId=b-123' }), {})

    expect(mockListTasks).toHaveBeenCalledWith('mock-user-001', {
      status: undefined,
      bunjinId: 'b-123',
      limit: 50,
    })
  })

  it('respects custom limit', async () => {
    mockListTasks.mockResolvedValue([])

    const { GET } = await import('@/app/api/tasks/route.js')
    await GET(makeRequest({ url: 'http://localhost/api/tasks?limit=10' }), {})

    expect(mockListTasks).toHaveBeenCalledWith('mock-user-001', {
      status: undefined,
      bunjinId: undefined,
      limit: 10,
    })
  })

  it('caps limit at 200', async () => {
    mockListTasks.mockResolvedValue([])

    const { GET } = await import('@/app/api/tasks/route.js')
    await GET(makeRequest({ url: 'http://localhost/api/tasks?limit=999' }), {})

    expect(mockListTasks).toHaveBeenCalledWith('mock-user-001', {
      status: undefined,
      bunjinId: undefined,
      limit: 200,
    })
  })

  it('defaults to 50 for invalid limit', async () => {
    mockListTasks.mockResolvedValue([])

    const { GET } = await import('@/app/api/tasks/route.js')
    await GET(makeRequest({ url: 'http://localhost/api/tasks?limit=abc' }), {})

    expect(mockListTasks).toHaveBeenCalledWith('mock-user-001', {
      status: undefined,
      bunjinId: undefined,
      limit: 50,
    })
  })
})

describe('POST /api/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('creates a task with valid data', async () => {
    const created = { id: 't-new', title: 'New Task', status: 'TODO' }
    mockCreateTask.mockResolvedValue(created)

    const { POST } = await import('@/app/api/tasks/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: { title: 'New Task' },
      }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.task.title).toBe('New Task')
  })

  it('returns 400 when title is missing', async () => {
    const { POST } = await import('@/app/api/tasks/route.js')
    const res = await POST(
      makeRequest({
        method: 'POST',
        body: {},
      }),
      {},
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
  })
})
