/**
 * Rate Limiter（Upstash Redis）
 * - 未設定時（開発環境）はスキップ
 */

let ratelimitModule = null
let redisModule = null

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
    return { success: true }
  }

  const loaded = await loadModules()
  if (!loaded) {
    return { success: true }
  }

  const { Ratelimit } = ratelimitModule
  const { Redis } = redisModule

  const redis = new Redis({ url, token })
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
  })

  const result = await limiter.limit(identifier)
  return {
    success: result.success,
    remaining: result.remaining,
  }
}
