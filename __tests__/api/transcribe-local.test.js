import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateLocalSegment = vi.fn()

vi.mock('@/lib/services/local-segment-service.js', () => ({
  createLocalSegment: (...args) => mockCreateLocalSegment(...args),
}))

vi.mock('@/lib/validators.js', async () => {
  const actual = await vi.importActual('@/lib/validators.js')
  return {
    ...actual,
    validateBody: actual.validateBody,
  }
})

vi.mock('@/lib/transcribe-mode.js', async () => {
  const { z } = await import('zod')
  return {
    TRANSCRIBE_MODE: Object.freeze({ SERVER: 'SERVER', LOCAL: 'LOCAL' }),
    localTranscribeSchema: z.object({
      sessionId: z.string().min(1),
      segmentNo: z.number().int().min(0),
      startAt: z.string(),
      endAt: z.string(),
      text: z.string().min(1),
      selectedMode: z.enum(['SERVER', 'LOCAL']),
      executedMode: z.enum(['SERVER', 'LOCAL']),
      fallbackReason: z.string().nullable().optional(),
      localEngineVersion: z.string().nullable().optional(),
    }),
  }
})

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

function makeRequest({ body } = {}) {
  return {
    method: 'POST',
    url: 'http://localhost/api/transcribe/local',
    headers: new Headers(),
    json: async () => body || {},
  }
}

describe('POST /api/transcribe/local', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('有効なデータでセグメントを作成し、200を返す', async () => {
    const created = {
      id: 'seg-new',
      sessionId: 's1',
      segmentNo: 0,
      text: 'こんにちは',
      sttStatus: 'DONE',
      selectedMode: 'SERVER',
      executedMode: 'SERVER',
    }
    mockCreateLocalSegment.mockResolvedValue(created)

    const { POST } = await import('@/app/api/transcribe/local/route.js')
    const res = await POST(
      makeRequest({
        body: {
          sessionId: 's1',
          segmentNo: 0,
          startAt: '2026-02-17T10:00:00Z',
          endAt: '2026-02-17T10:05:00Z',
          text: 'こんにちは',
          selectedMode: 'SERVER',
          executedMode: 'SERVER',
        },
      }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.segmentId).toBe('seg-new')
    expect(res._body.data.sttStatus).toBe('DONE')
    expect(mockCreateLocalSegment).toHaveBeenCalledWith(
      'mock-user-001',
      expect.objectContaining({
        sessionId: 's1',
        text: 'こんにちは',
        selectedMode: 'SERVER',
        executedMode: 'SERVER',
      })
    )
  })

  it('LOCAL→LOCAL でもセグメントを作成できる', async () => {
    mockCreateLocalSegment.mockResolvedValue({
      id: 'seg-local',
      sttStatus: 'DONE',
    })

    const { POST } = await import('@/app/api/transcribe/local/route.js')
    const res = await POST(
      makeRequest({
        body: {
          sessionId: 's1',
          segmentNo: 1,
          startAt: '2026-02-17T10:00:00Z',
          endAt: '2026-02-17T10:05:00Z',
          text: 'ローカルテスト',
          selectedMode: 'LOCAL',
          executedMode: 'LOCAL',
          localEngineVersion: 'whisper-1.0.0',
        },
      }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.success).toBe(true)
  })

  it('sessionIdが空の場合は400を返す', async () => {
    const { POST } = await import('@/app/api/transcribe/local/route.js')
    const res = await POST(
      makeRequest({
        body: {
          sessionId: '',
          segmentNo: 0,
          startAt: '2026-02-17T10:00:00Z',
          endAt: '2026-02-17T10:05:00Z',
          text: 'test',
          selectedMode: 'SERVER',
          executedMode: 'SERVER',
        },
      }),
      {},
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
  })

  it('textが空の場合は400を返す', async () => {
    const { POST } = await import('@/app/api/transcribe/local/route.js')
    const res = await POST(
      makeRequest({
        body: {
          sessionId: 's1',
          segmentNo: 0,
          startAt: '2026-02-17T10:00:00Z',
          endAt: '2026-02-17T10:05:00Z',
          text: '',
          selectedMode: 'SERVER',
          executedMode: 'SERVER',
        },
      }),
      {},
    )

    expect(res.status).toBe(400)
    expect(res._body.success).toBe(false)
  })

  it('NotFoundError (404) をハンドルする', async () => {
    const { NotFoundError } = await import('@/lib/errors.js')
    mockCreateLocalSegment.mockRejectedValue(new NotFoundError('Session', 'nonexistent'))

    const { POST } = await import('@/app/api/transcribe/local/route.js')
    const res = await POST(
      makeRequest({
        body: {
          sessionId: 'nonexistent',
          segmentNo: 0,
          startAt: '2026-02-17T10:00:00Z',
          endAt: '2026-02-17T10:05:00Z',
          text: 'test',
          selectedMode: 'SERVER',
          executedMode: 'SERVER',
        },
      }),
      {},
    )

    expect(res.status).toBe(404)
    expect(res._body.success).toBe(false)
  })

  it('予期しないエラーは500を返す', async () => {
    mockCreateLocalSegment.mockRejectedValue(new Error('DB error'))

    const { POST } = await import('@/app/api/transcribe/local/route.js')
    const res = await POST(
      makeRequest({
        body: {
          sessionId: 's1',
          segmentNo: 0,
          startAt: '2026-02-17T10:00:00Z',
          endAt: '2026-02-17T10:05:00Z',
          text: 'test',
          selectedMode: 'SERVER',
          executedMode: 'SERVER',
        },
      }),
      {},
    )

    expect(res.status).toBe(500)
    expect(res._body.success).toBe(false)
  })
})
