/**
 * 構造化ログユーティリティ
 * - サーバーサイド: JSON構造化ログ
 * - クライアントサイド: console wrapper (開発時のみ出力)
 */

const isServer = typeof window === 'undefined'
const isDev = process.env.NODE_ENV !== 'production'

const SENSITIVE_KEYS = new Set(['password', 'token', 'key', 'secret', 'authorization', 'apikey'])

/**
 * metaオブジェクトのsensitiveキーをマスクする（大文字小文字を区別しない）
 * @param {Object} meta
 * @returns {Object} マスク済みの新しいオブジェクト
 */
function maskSensitiveMeta(meta) {
  const masked = {}
  for (const [k, v] of Object.entries(meta)) {
    masked[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '***' : v
  }
  return masked
}

/**
 * サーバーサイド構造化ログ
 */
function formatServerLog(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...maskSensitiveMeta(meta),
  }
  return JSON.stringify(entry)
}

/**
 * サーバーサイドロガー
 */
const serverLogger = {
  info(message, meta) {
    console.log(formatServerLog('info', message, meta))
  },
  warn(message, meta) {
    console.warn(formatServerLog('warn', message, meta))
  },
  error(message, meta) {
    console.error(formatServerLog('error', message, meta))
  },
  debug(message, meta) {
    if (isDev) {
      console.debug(formatServerLog('debug', message, meta))
    }
  },
}

/**
 * クライアントサイドロガー (開発時のみ出力)
 */
const clientLogger = {
  info(message, meta) {
    if (isDev) console.log(`[INFO] ${message}`, meta || '')
  },
  warn(message, meta) {
    if (isDev) console.warn(`[WARN] ${message}`, meta || '')
  },
  error(message, meta) {
    if (isDev) console.error(`[ERROR] ${message}`, meta || '')
  },
  debug(message, meta) {
    if (isDev) console.debug(`[DEBUG] ${message}`, meta || '')
  },
}

export const logger = isServer ? serverLogger : clientLogger
