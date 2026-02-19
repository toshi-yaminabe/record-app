import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before importing middleware
vi.mock('@/lib/prisma.js', () => ({
  prisma: { _isMock: true },
}))

vi.mock('@/lib/supabase.js', () => ({
  getSupabaseAdmin: vi.fn(),
  getSupabaseAuthClient: vi.fn(),
  getSupabaseAuthConfigStatus: vi.fn(() => ({ ok: true })),
}))

vi.mock('@/lib/rate-limit.js', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 29 }),
}))

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body, init) => ({
      _body: body,
      status: init?.status || 200,
      json: async () => body,
    }),
  },
}))

import { withApi } from '@/lib/middleware.js'
import { getSupabaseAdmin, getSupabaseAuthClient } from '@/lib/supabase.js'
import { checkRateLimit } from '@/lib/rate-limit.js'

// Helper: minimal Request mock
function makeRequest({ method = 'GET', url = 'http://localhost/api/test', headers = {}, body } = {}) {
  const reqHeaders = new Headers(headers)
  return {
    method,
    url,
    headers: reqHeaders,
    json: async () => body || {},
  }
}

describe('withApi middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: rate limit passes
    checkRateLimit.mockResolvedValue({ success: true, remaining: 29 })
  })

  // ============================================
  // DB接続チェック
  // ============================================
  describe('DB connection check', () => {
    it('returns 503 when prisma is null', async () => {
      // Temporarily override prisma to null
      const prismaModule = await import('@/lib/prisma.js')
      const original = prismaModule.prisma
      prismaModule.prisma = null

      const handler = withApi(async () => ({ ok: true }))
      const res = await handler(makeRequest(), {})

      expect(res.status).toBe(503)
      expect(res._body.success).toBe(false)
      expect(res._body.error).toContain('Database')

      // Restore
      prismaModule.prisma = original
    })
  })

  // ============================================
  // DEV_AUTH_BYPASS
  // ============================================
  describe('DEV_AUTH_BYPASS', () => {
    it('allows access with DEV_AUTH_BYPASS in development', async () => {
      const originalEnv = { ...process.env }
      process.env.NODE_ENV = 'development'
      process.env.DEV_AUTH_BYPASS = 'true'

      let capturedUserId
      const handler = withApi(async (req, ctx) => {
        capturedUserId = ctx.userId
        return { ok: true }
      })

      const res = await handler(makeRequest(), {})

      expect(res.status).toBe(200)
      expect(res._body.success).toBe(true)
      expect(capturedUserId).toBe('mock-user-001')

      // Restore
      Object.assign(process.env, originalEnv)
    })
  })

  // ============================================
  // JWT認証
  // ============================================
  describe('JWT authentication', () => {
    it('returns 401 when no Authorization header', async () => {
      const originalEnv = { ...process.env }
      process.env.NODE_ENV = 'production'
      delete process.env.DEV_AUTH_BYPASS
      getSupabaseAuthClient.mockReturnValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: 'invalid' }) },
      })

      const handler = withApi(async () => ({ ok: true }))
      const res = await handler(makeRequest(), {})

      expect(res.status).toBe(401)
      expect(res._body.error).toContain('Authentication')

      Object.assign(process.env, originalEnv)
    })

    it('authenticates with valid JWT', async () => {
      const originalEnv = { ...process.env }
      process.env.NODE_ENV = 'production'
      delete process.env.DEV_AUTH_BYPASS
      const mockUser = { id: 'user-uuid-123' }
      getSupabaseAuthClient.mockReturnValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      })

      let capturedUserId
      const handler = withApi(async (req, ctx) => {
        capturedUserId = ctx.userId
        return { ok: true }
      })
      const res = await handler(
        makeRequest({ headers: { Authorization: 'Bearer valid-token' } }),
        {},
      )

      expect(res.status).toBe(200)
      expect(capturedUserId).toBe('user-uuid-123')

      Object.assign(process.env, originalEnv)
    })

    it('returns 401 with invalid JWT', async () => {
      const originalEnv = { ...process.env }
      process.env.NODE_ENV = 'production'
      delete process.env.DEV_AUTH_BYPASS
      getSupabaseAuthClient.mockReturnValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: 'expired' }) },
      })

      const handler = withApi(async () => ({ ok: true }))
      const res = await handler(
        makeRequest({ headers: { Authorization: 'Bearer expired-token' } }),
        {},
      )

      expect(res.status).toBe(401)

      Object.assign(process.env, originalEnv)
    })
  })

  // ============================================
  // Cronモード
  // ============================================
  describe('cronMode', () => {
    it('authenticates with CRON_SECRET', async () => {
      const originalEnv = { ...process.env }
      process.env.CRON_SECRET = 'my-secret'

      const handler = withApi(async () => ({ archived: 5 }), { cronMode: true })
      const res = await handler(
        makeRequest({ headers: { Authorization: 'Bearer my-secret' } }),
        {},
      )

      expect(res.status).toBe(200)
      expect(res._body.data.archived).toBe(5)

      Object.assign(process.env, originalEnv)
    })

    it('returns 401 with wrong CRON_SECRET', async () => {
      const originalEnv = { ...process.env }
      process.env.CRON_SECRET = 'my-secret'

      const handler = withApi(async () => ({ ok: true }), { cronMode: true })
      const res = await handler(
        makeRequest({ headers: { Authorization: 'Bearer wrong-secret' } }),
        {},
      )

      expect(res.status).toBe(401)

      Object.assign(process.env, originalEnv)
    })
  })

  // ============================================
  // レートリミット
  // ============================================
  describe('rate limiting', () => {
    it('returns 429 when rate limit exceeded', async () => {
      const originalEnv = { ...process.env }
      process.env.NODE_ENV = 'development'
      process.env.DEV_AUTH_BYPASS = 'true'
      checkRateLimit.mockResolvedValue({ success: false, remaining: 0 })

      const handler = withApi(async () => ({ ok: true }))
      const res = await handler(makeRequest(), {})

      expect(res.status).toBe(429)
      expect(res._body.error).toContain('Rate limit')

      Object.assign(process.env, originalEnv)
    })

    it('passes custom rate limit config to checkRateLimit', async () => {
      const originalEnv = { ...process.env }
      process.env.NODE_ENV = 'development'
      process.env.DEV_AUTH_BYPASS = 'true'

      const handler = withApi(async () => ({ ok: true }), {
        rateLimit: { requests: 10, window: '1 m' },
      })
      await handler(makeRequest(), {})

      expect(checkRateLimit).toHaveBeenCalledWith(
        'mock-user-001',
        { requests: 10, window: '1 m' },
      )

      Object.assign(process.env, originalEnv)
    })
  })

  // ============================================
  // 統一レスポンスエンベロープ
  // ============================================
  describe('response envelope', () => {
    it('wraps handler result in { success: true, data }', async () => {
      const originalEnv = { ...process.env }
      process.env.NODE_ENV = 'development'
      process.env.DEV_AUTH_BYPASS = 'true'

      const handler = withApi(async () => ({ sessions: [{ id: '1' }] }))
      const res = await handler(makeRequest(), {})

      expect(res._body).toEqual({
        success: true,
        data: { sessions: [{ id: '1' }] },
      })

      Object.assign(process.env, originalEnv)
    })
  })

  // ============================================
  // エラーハンドリング
  // ============================================
  describe('error handling', () => {
    it('handles AppError with correct status', async () => {
      const originalEnv = { ...process.env }
      process.env.NODE_ENV = 'development'
      process.env.DEV_AUTH_BYPASS = 'true'

      const { ValidationError } = await import('@/lib/errors.js')
      const handler = withApi(async () => {
        throw new ValidationError('deviceId is required')
      })
      const res = await handler(makeRequest(), {})

      expect(res.status).toBe(400)
      expect(res._body.success).toBe(false)
      expect(res._body.error).toBe('deviceId is required')

      Object.assign(process.env, originalEnv)
    })

    it('handles Prisma P2002 (unique constraint)', async () => {
      const originalEnv = { ...process.env }
      process.env.NODE_ENV = 'development'
      process.env.DEV_AUTH_BYPASS = 'true'

      const handler = withApi(async () => {
        const error = new Error('Unique constraint failed')
        error.code = 'P2002'
        throw error
      })
      const res = await handler(makeRequest(), {})

      expect(res.status).toBe(409)
      expect(res._body.error).toContain('already exists')

      Object.assign(process.env, originalEnv)
    })

    it('handles unknown errors as 500', async () => {
      const originalEnv = { ...process.env }
      process.env.NODE_ENV = 'development'
      process.env.DEV_AUTH_BYPASS = 'true'

      const handler = withApi(async () => {
        throw new Error('Unexpected')
      })
      const res = await handler(makeRequest(), {})

      expect(res.status).toBe(500)
      expect(res._body.error).toBe('Internal server error')

      Object.assign(process.env, originalEnv)
    })
  })

  // ============================================
  // apiContext immutability
  // ============================================
  describe('apiContext', () => {
    it('provides frozen context object', async () => {
      const originalEnv = { ...process.env }
      process.env.NODE_ENV = 'development'
      process.env.DEV_AUTH_BYPASS = 'true'

      let capturedCtx
      const handler = withApi(async (req, ctx) => {
        capturedCtx = ctx
        return { ok: true }
      })
      await handler(makeRequest(), {})

      expect(Object.isFrozen(capturedCtx)).toBe(true)
      expect(capturedCtx.userId).toBe('mock-user-001')

      Object.assign(process.env, originalEnv)
    })
  })

  // ============================================
  // requireAuth: false
  // ============================================
  describe('requireAuth: false', () => {
    it('allows unauthenticated access', async () => {
      const handler = withApi(async (req, ctx) => {
        return { userId: ctx.userId }
      }, { requireAuth: false })

      const res = await handler(makeRequest(), {})

      expect(res.status).toBe(200)
      expect(res._body.data.userId).toBe(null)
    })
  })
})
