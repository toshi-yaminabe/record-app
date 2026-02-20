/**
 * Rate Limiter（Upstash Redis）
 * - 未設定時（開発環境）はスキップ
 * - 本番環境で未設定の場合は起動時に1回だけ警告ログを出す
 */

import { logger } from '@/lib/logger.js'

let ratelimitModule = null
let redisModule = null
const limiterCache = new Map()
let productionWarningLogged = false

async function loadModules() {
  if (!ratelimitModule) {
    try {
      ratelimitModule = await import('@upstash/ratelimit')
      redisModule = await import('@upstash/redis')
    } catch {
      return false
    }
  }
  return true
}

/**
 * レートリミットチェック
 * @param {string} identifier - レートリミット識別子（userId or IP）
 * @param {{ requests: number, window: string }} config - レートリミット設定
 * @returns {Promise<{ success: boolean, remaining?: number }>}
 */
export async function checkRateLimit(identifier, { requests = 30, window = '1 m' } = {}) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Rate limiting is not configured: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is not set')
    }
    if (!productionWarningLogged) {
      productionWarningLogged = true
      logger.warn(
        'Rate limiting is disabled in development: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is not set',
        { component: 'rate-limit' }
      )
    }
    return { success: true }
  }

  const loaded = await loadModules()
  if (!loaded) {
    return { success: true }
  }

  const { Ratelimit } = ratelimitModule
  const { Redis } = redisModule

  // Cache key based on rate limit configuration
  const cacheKey = `${requests}:${window}`

  // Reuse cached limiter if available
  let limiter = limiterCache.get(cacheKey)
  if (!limiter) {
    const redis = new Redis({ url, token })
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(requests, window),
    })
    limiterCache.set(cacheKey, limiter)
  }

  const result = await limiter.limit(identifier)
  return {
    success: result.success,
    remaining: result.remaining,
  }
}
