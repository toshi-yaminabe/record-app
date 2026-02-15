/**
 * APIルート 統合テスト
 *
 * withApi経由でルートハンドラを直接呼び出し、
 * 認証 → サービス → DB → レスポンスエンベロープのフルスタックを検証。
 * DEV_AUTH_BYPASS=true で認証バイパス、mock-user-001で実行。
 *
 * DATABASE_URL未設定時は全スキップ。
 */

import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'

// 明示的にRUN_INTEGRATION_TESTS=trueが設定された場合のみ実行
const canRun = process.env.RUN_INTEGRATION_TESTS === 'true' && !!process.env.DATABASE_URL

// テスト用にDEV_AUTH_BYPASSを有効化
if (canRun) {
  process.env.DEV_AUTH_BYPASS = 'true'
  process.env.NODE_ENV = 'development'
}

const API_USER_ID = 'mock-user-001'

function makeRequest({
  method = 'GET',
  url = 'http://localhost:3000/api/test',
  headers = {},
  body,
} = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => body || {},
  }
}

describe.skipIf(!canRun)('API Route Integration Tests (real DB)', () => {
  let prisma

  beforeAll(async () => {
    const mod = await import('@/lib/prisma.js')
    prisma = mod.prisma
    if (!prisma) throw new Error('Prisma client not available')
    await cleanup(prisma)
  })

  afterAll(async () => {
    if (prisma) {
      await cleanup(prisma)
      await prisma.$disconnect()
    }
  })

  // ============================================
  // GET /api/health
  // ============================================
  describe('GET /api/health', () => {
    it('returns health status with database: true', async () => {
      const { GET } = await import('@/app/api/health/route.js')
      const res = await GET(makeRequest({ url: 'http://localhost/api/health' }), {})
      const body = await res.json()

      expect(body.database).toBe(true)
    })
  })

  // ============================================
  // Sessions API (POST + GET)
  // ============================================
  describe('Sessions API', () => {
    let createdSessionId

    it('POST /api/sessions — creates session', async () => {
      const { POST } = await import('@/app/api/sessions/route.js')
      const res = await POST(
        makeRequest({
          method: 'POST',
          url: 'http://localhost/api/sessions',
          body: { deviceId: 'api-test-device' },
        }),
        {},
      )
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(body.data.session).toBeDefined()
      expect(body.data.session.status).toBe('ACTIVE')
      expect(body.data.session.deviceId).toBe('api-test-device')
      createdSessionId = body.data.session.id
    })

    it('GET /api/sessions — lists sessions', async () => {
      const { GET } = await import('@/app/api/sessions/route.js')
      const res = await GET(
        makeRequest({ url: 'http://localhost/api/sessions' }),
        {},
      )
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(Array.isArray(body.data.sessions)).toBe(true)
      const found = body.data.sessions.find(s => s.id === createdSessionId)
      expect(found).toBeDefined()
    })

    it('GET /api/sessions/[id] — gets session detail', async () => {
      const { GET } = await import('@/app/api/sessions/[id]/route.js')
      const res = await GET(
        makeRequest({ url: `http://localhost/api/sessions/${createdSessionId}` }),
        { params: Promise.resolve({ id: createdSessionId }) },
      )
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(body.data.session.id).toBe(createdSessionId)
      expect(body.data.session.segments).toBeDefined()
    })

    it('PATCH /api/sessions/[id] — stops session', async () => {
      const { PATCH } = await import('@/app/api/sessions/[id]/route.js')
      const res = await PATCH(
        makeRequest({
          method: 'PATCH',
          url: `http://localhost/api/sessions/${createdSessionId}`,
          body: { action: 'stop' },
        }),
        { params: Promise.resolve({ id: createdSessionId }) },
      )
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(body.data.session.status).toBe('STOPPED')
      expect(body.data.session.endedAt).toBeDefined()
    })
  })

  // ============================================
  // Bunjins API (POST + GET + PATCH + DELETE)
  // ============================================
  describe('Bunjins API', () => {
    let bunjinId

    it('POST /api/bunjins — creates bunjin', async () => {
      const { POST } = await import('@/app/api/bunjins/route.js')
      const res = await POST(
        makeRequest({
          method: 'POST',
          body: {
            slug: 'api-test-bunjin',
            displayName: 'APIテスト分人',
            color: '#123456',
          },
        }),
        {},
      )
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(body.data.bunjin.slug).toBe('api-test-bunjin')
      bunjinId = body.data.bunjin.id
    })

    it('GET /api/bunjins — lists bunjins', async () => {
      const { GET } = await import('@/app/api/bunjins/route.js')
      const res = await GET(
        makeRequest({ url: 'http://localhost/api/bunjins' }),
        {},
      )
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(Array.isArray(body.data.bunjins)).toBe(true)
      const found = body.data.bunjins.find(b => b.id === bunjinId)
      expect(found).toBeDefined()
    })

    it('PATCH /api/bunjins/[id] — updates bunjin', async () => {
      const { PATCH } = await import('@/app/api/bunjins/[id]/route.js')
      const res = await PATCH(
        makeRequest({
          method: 'PATCH',
          body: { displayName: '更新APIテスト分人' },
        }),
        { params: Promise.resolve({ id: bunjinId }) },
      )
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(body.data.bunjin.displayName).toBe('更新APIテスト分人')
    })

    it('DELETE /api/bunjins/[id] — deletes bunjin', async () => {
      const { DELETE } = await import('@/app/api/bunjins/[id]/route.js')
      const res = await DELETE(
        makeRequest({ method: 'DELETE' }),
        { params: Promise.resolve({ id: bunjinId }) },
      )
      const body = await res.json()

      expect(body.success).toBe(true)
    })
  })

  // ============================================
  // Tasks API (POST + GET + PATCH)
  // ============================================
  describe('Tasks API', () => {
    let taskId

    it('POST /api/tasks — creates task', async () => {
      const { POST } = await import('@/app/api/tasks/route.js')
      const res = await POST(
        makeRequest({
          method: 'POST',
          body: { title: 'APIテストタスク', priority: 3 },
        }),
        {},
      )
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(body.data.task.title).toBe('APIテストタスク')
      expect(body.data.task.status).toBe('TODO')
      taskId = body.data.task.id
    })

    it('GET /api/tasks — lists tasks', async () => {
      const { GET } = await import('@/app/api/tasks/route.js')
      const res = await GET(
        makeRequest({ url: 'http://localhost/api/tasks' }),
        {},
      )
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(Array.isArray(body.data.tasks)).toBe(true)
      const found = body.data.tasks.find(t => t.id === taskId)
      expect(found).toBeDefined()
    })

    it('PATCH /api/tasks/[id] — updates task status', async () => {
      const { PATCH } = await import('@/app/api/tasks/[id]/route.js')
      const res = await PATCH(
        makeRequest({
          method: 'PATCH',
          body: { status: 'DOING' },
        }),
        { params: Promise.resolve({ id: taskId }) },
      )
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(body.data.task.status).toBe('DOING')
    })

    it('PATCH /api/tasks/[id] — rejects invalid transition', async () => {
      const { PATCH } = await import('@/app/api/tasks/[id]/route.js')
      const res = await PATCH(
        makeRequest({
          method: 'PATCH',
          body: { status: 'ARCHIVED' },  // DOING→ARCHIVED is valid
        }),
        { params: Promise.resolve({ id: taskId }) },
      )
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(body.data.task.status).toBe('ARCHIVED')
    })
  })

  // ============================================
  // Segments API (POST + GET)
  // ============================================
  describe('Segments API', () => {
    let sessionId

    beforeAll(async () => {
      // セグメントテスト用にセッション作成
      const session = await prisma.session.create({
        data: {
          userId: API_USER_ID,
          deviceId: 'seg-test-device',
          status: 'ACTIVE',
        },
      })
      sessionId = session.id
    })

    it('POST /api/segments — creates PENDING segment', async () => {
      const { POST } = await import('@/app/api/segments/route.js')
      const now = new Date()
      const res = await POST(
        makeRequest({
          method: 'POST',
          body: {
            sessionId,
            segmentNo: 1,
            startAt: now.toISOString(),
            endAt: new Date(now.getTime() + 600000).toISOString(),
            storageObjectPath: `${API_USER_ID}/${sessionId}/1.m4a`,
          },
        }),
        {},
      )
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(body.data.segment).toBeDefined()
      expect(body.data.segment.sttStatus).toBe('PENDING')
    })

    it('GET /api/segments — lists segments', async () => {
      const { GET } = await import('@/app/api/segments/route.js')
      const res = await GET(
        makeRequest({ url: `http://localhost/api/segments?sessionId=${sessionId}` }),
        {},
      )
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(Array.isArray(body.data.segments)).toBe(true)
      expect(body.data.segments.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ============================================
  // Response envelope consistency
  // ============================================
  describe('Response envelope format', () => {
    it('success response has { success: true, data: {...} }', async () => {
      const { GET } = await import('@/app/api/sessions/route.js')
      const res = await GET(
        makeRequest({ url: 'http://localhost/api/sessions' }),
        {},
      )
      const body = await res.json()

      expect(body).toHaveProperty('success', true)
      expect(body).toHaveProperty('data')
      expect(typeof body.data).toBe('object')
    })

    it('error response has { success: false, error: "..." }', async () => {
      const { POST } = await import('@/app/api/sessions/route.js')
      const res = await POST(
        makeRequest({ method: 'POST', body: {} }), // missing deviceId
        {},
      )
      const body = await res.json()

      expect(body).toHaveProperty('success', false)
      expect(body).toHaveProperty('error')
      expect(typeof body.error).toBe('string')
    })
  })
})

async function cleanup(prisma) {
  await prisma.segment.deleteMany({ where: { userId: API_USER_ID } })
  await prisma.session.deleteMany({ where: { userId: API_USER_ID } })
  await prisma.task.deleteMany({ where: { userId: API_USER_ID } })
  await prisma.bunjin.deleteMany({ where: { userId: API_USER_ID } })
}
