/**
 * withApi ミドルウェア
 * - DB接続チェック
 * - Supabase Auth JWT認証 (DEV_AUTH_BYPASS対応)
 * - レートリミット
 * - 統一エラーレスポンス
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.js'
import { getSupabaseAuthClient, getSupabaseAuthConfigStatus } from '@/lib/supabase.js'
import { checkRateLimit } from '@/lib/rate-limit.js'
import { AppError } from '@/lib/errors.js'
import { logger } from '@/lib/logger.js'
import { MOCK_USER_ID } from '@/lib/constants.js'

/**
 * APIミドルウェアラッパー
 *
 * @param {Function} handler - (request, context) => Promise<Response>
 *   context: { userId, params }
 * @param {Object} options
 * @param {boolean} options.requireAuth - 認証必須（デフォルト: true）
 * @param {{ requests: number, window: string }} options.rateLimit - レートリミット設定
 * @param {boolean} options.cronMode - Cronジョブモード（CRON_SECRET認証）
 * @returns {Function} Next.js APIルートハンドラ
 */
export function withApi(handler, options = {}) {
  const {
    requireAuth = true,
    rateLimit = { requests: 30, window: '1 m' },
    cronMode = false,
  } = options

  return async (request, routeContext) => {
    try {
      // 1. DB接続チェック
      if (!prisma) {
        return NextResponse.json(
          { success: false, error: 'Database not configured' },
          { status: 503 }
        )
      }

      let userId = null

      // 2. 認証
      if (cronMode) {
        // Cronモード: CRON_SECRET認証
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
          return NextResponse.json(
            { success: false, error: 'Unauthorized' },
            { status: 401 }
          )
        }
      } else if (requireAuth) {
        userId = await authenticateUser(request)
        if (!userId) {
          return NextResponse.json(
            { success: false, error: 'Authentication required' },
            { status: 401 }
          )
        }
      }

      // 3. レートリミット
      const rateLimitId = userId
        || request.headers.get('x-real-ip')
        || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || 'anonymous'
      let rateLimitResult
      try {
        rateLimitResult = await checkRateLimit(rateLimitId, rateLimit)
      } catch (error) {
        logger.error('Rate limit provider error', {
          component: 'middleware',
          error: error.message,
        })
        throw new AppError('Rate limit service unavailable', 503)
      }

      if (!rateLimitResult.success) {
        return NextResponse.json(
          { success: false, error: 'Rate limit exceeded' },
          { status: 429 }
        )
      }

      // 4. ハンドラ実行
      const params = routeContext?.params ? await routeContext.params : {}
      const apiContext = Object.freeze({ userId, params })
      const result = await handler(request, apiContext)

      // ハンドラが直接Responseを返した場合（ストリーミング等）
      if (result instanceof Response) {
        return result
      }

      // 統一エンベロープ
      return NextResponse.json({
        success: true,
        data: result,
      })
    } catch (error) {
      return handleApiError(error)
    }
  }
}

/**
 * ユーザー認証
 * - 開発環境 + DEV_AUTH_BYPASS: モックユーザー使用
 * - 本番環境: Supabase Auth JWT検証
 *
 * @param {Request} request
 * @returns {Promise<string|null>} userId
 */
async function authenticateUser(request) {
  // 認証バイパス（開発環境のみ許可）
  if (process.env.DEV_AUTH_BYPASS === 'true' && process.env.NODE_ENV !== 'production') {
    return MOCK_USER_ID
  }

  // Supabase Auth JWT検証
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const configStatus = getSupabaseAuthConfigStatus()
  if (!configStatus.ok) {
    if (process.env.NODE_ENV === 'development') {
      return MOCK_USER_ID
    }
    throw new AppError(`Auth configuration error: ${configStatus.reason}`, 503)
  }

  const supabase = getSupabaseAuthClient()
  if (!supabase) {
    throw new AppError('Auth client initialization failed', 503)
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return null
    }
    return user.id
  } catch {
    return null
  }
}

/**
 * エラーレスポンス生成
 * @param {Error} error
 * @returns {NextResponse}
 */
function handleApiError(error) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.statusCode }
    )
  }

  // Prismaのユニーク制約違反
  if (error?.code === 'P2002') {
    return NextResponse.json(
      { success: false, error: 'Resource already exists' },
      { status: 409 }
    )
  }

  // Prismaのレコード未検出
  if (error?.code === 'P2025') {
    return NextResponse.json(
      { success: false, error: 'Record not found' },
      { status: 404 }
    )
  }

  logger.error('Unhandled API error', { component: 'middleware', error: error.message, stack: error.stack })
  return NextResponse.json(
    { success: false, error: 'Internal server error' },
    { status: 500 }
  )
}
