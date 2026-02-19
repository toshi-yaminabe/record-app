import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockTranscribeAudio = vi.fn()
const mockSessionFindFirst = vi.fn()
const mockSessionCreate = vi.fn()
const mockSegmentUpsert = vi.fn()
const mockSegmentFindMany = vi.fn()

vi.mock('@/lib/prisma.js', () => ({
  prisma: {
    session: {
      findFirst: (...args) => mockSessionFindFirst(...args),
      create: (...args) => mockSessionCreate(...args),
    },
    segment: {
      upsert: (...args) => mockSegmentUpsert(...args),
      findMany: (...args) => mockSegmentFindMany(...args),
    },
    publishedVersion: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}))

vi.mock('@/lib/gemini.js', () => ({
  transcribeAudio: (...args) => mockTranscribeAudio(...args),
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
      headers: init?.headers || {},
      json: async () => body,
    }),
  },
}))

function makeFormData({ audio, deviceId, sessionId, segmentNo, startAt, endAt } = {}) {
  const fd = new Map()
  fd.set('audio', audio || new Blob(['fake-audio'], { type: 'audio/mp4' }))
  fd.set('deviceId', deviceId || 'dev-001')
  fd.set('sessionId', sessionId || 'sess-001')
  if (segmentNo !== undefined) fd.set('segmentNo', String(segmentNo))
  if (startAt) fd.set('startAt', startAt)
  if (endAt) fd.set('endAt', endAt)
  return {
    get: (key) => fd.get(key) ?? null,
  }
}

function makeRequest({ method = 'POST', url = 'http://localhost/api/transcribe', headers = {}, formData } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    formData: async () => formData || makeFormData(),
    json: async () => ({}),
  }
}

describe('POST /api/transcribe - handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('returns 413 when content-length exceeds max', async () => {
    const { POST } = await import('@/app/api/transcribe/route.js')
    const res = await POST(
      makeRequest({
        headers: { 'content-length': '7000000' },
      }),
      {},
    )
    expect(res.status).toBe(413)
  })

  it('returns 400 when required fields missing', async () => {
    const fd = {
      get: (key) => {
        if (key === 'audio') return null
        if (key === 'deviceId') return null
        if (key === 'sessionId') return null
        return null
      },
    }

    const { POST } = await import('@/app/api/transcribe/route.js')
    const res = await POST(
      makeRequest({ formData: fd }),
      {},
    )
    expect(res.status).toBe(400)
    expect(res._body.error).toContain('Missing required fields')
  })

  it('returns 415 for unsupported audio format', async () => {
    const badAudio = new Blob(['data'], { type: 'video/mp4' })
    Object.defineProperty(badAudio, 'size', { value: 100 })
    const fd = makeFormData({ audio: badAudio })

    const { POST } = await import('@/app/api/transcribe/route.js')
    const res = await POST(makeRequest({ formData: fd }), {})
    expect(res.status).toBe(415)
  })

  it('transcribes and creates segment with existing session', async () => {
    const audioBlob = new Blob(['audio-data'], { type: 'audio/mp4' })
    Object.defineProperty(audioBlob, 'size', { value: 1000 })
    const fd = makeFormData({ audio: audioBlob, segmentNo: '2' })

    mockTranscribeAudio.mockResolvedValue('こんにちは')
    mockSessionFindFirst.mockResolvedValue({ id: 'sess-001', deviceId: 'dev-001' })
    mockSegmentUpsert.mockResolvedValue({
      id: 'seg-1',
      sessionId: 'sess-001',
      segmentNo: 2,
      text: 'こんにちは',
      sttStatus: 'DONE',
    })

    const { POST } = await import('@/app/api/transcribe/route.js')
    const res = await POST(makeRequest({ formData: fd }), {})

    expect(res.status).toBe(200)
    expect(mockTranscribeAudio).toHaveBeenCalled()
    expect(mockSessionFindFirst).toHaveBeenCalled()
    expect(mockSessionCreate).not.toHaveBeenCalled()
    expect(mockSegmentUpsert).toHaveBeenCalled()
  })

  it('creates new session when none exists', async () => {
    const audioBlob = new Blob(['audio-data'], { type: 'audio/mp4' })
    Object.defineProperty(audioBlob, 'size', { value: 1000 })
    const fd = makeFormData({ audio: audioBlob })

    mockTranscribeAudio.mockResolvedValue('テスト')
    mockSessionFindFirst.mockResolvedValue(null)
    mockSessionCreate.mockResolvedValue({ id: 'new-sess', deviceId: 'dev-001' })
    mockSegmentUpsert.mockResolvedValue({
      id: 'seg-new',
      sessionId: 'new-sess',
      segmentNo: 0,
      text: 'テスト',
      sttStatus: 'DONE',
    })

    const { POST } = await import('@/app/api/transcribe/route.js')
    const res = await POST(makeRequest({ formData: fd }), {})

    expect(res.status).toBe(200)
    expect(mockSessionCreate).toHaveBeenCalled()
  })

  it('returns 504 on Gemini timeout', async () => {
    const audioBlob = new Blob(['audio-data'], { type: 'audio/mp4' })
    Object.defineProperty(audioBlob, 'size', { value: 1000 })
    const fd = makeFormData({ audio: audioBlob })

    mockTranscribeAudio.mockRejectedValue(new Error('Request timeout'))

    const { POST } = await import('@/app/api/transcribe/route.js')
    const res = await POST(makeRequest({ formData: fd }), {})
    expect(res.status).toBe(504)
  })

  it('returns 502 on Gemini rate limit', async () => {
    const audioBlob = new Blob(['audio-data'], { type: 'audio/mp4' })
    Object.defineProperty(audioBlob, 'size', { value: 1000 })
    const fd = makeFormData({ audio: audioBlob })

    mockTranscribeAudio.mockRejectedValue(new Error('rate limit exceeded'))

    const { POST } = await import('@/app/api/transcribe/route.js')
    const res = await POST(makeRequest({ formData: fd }), {})
    expect(res.status).toBe(502)
  })

  it('returns 502 on Gemini API error', async () => {
    const audioBlob = new Blob(['audio-data'], { type: 'audio/mp4' })
    Object.defineProperty(audioBlob, 'size', { value: 1000 })
    const fd = makeFormData({ audio: audioBlob })

    mockTranscribeAudio.mockRejectedValue(new Error('GEMINI_API_KEY not configured'))

    const { POST } = await import('@/app/api/transcribe/route.js')
    const res = await POST(makeRequest({ formData: fd }), {})
    expect(res.status).toBe(502)
  })
})

describe('GET /api/transcribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
    process.env.DEV_AUTH_BYPASS = 'true'
  })

  it('returns segments list', async () => {
    mockSegmentFindMany.mockResolvedValue([
      { id: 's1', text: 'text1' },
      { id: 's2', text: 'text2' },
    ])

    const { GET } = await import('@/app/api/transcribe/route.js')
    const res = await GET(
      makeRequest({ method: 'GET', url: 'http://localhost/api/transcribe' }),
      {},
    )

    expect(res.status).toBe(200)
    expect(res._body.data.segments).toHaveLength(2)
  })

  it('filters by sessionId', async () => {
    mockSegmentFindMany.mockResolvedValue([])

    const { GET } = await import('@/app/api/transcribe/route.js')
    await GET(
      makeRequest({ method: 'GET', url: 'http://localhost/api/transcribe?sessionId=s1' }),
      {},
    )

    expect(mockSegmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sessionId: 's1' }),
      }),
    )
  })
})
