import { randomBytes, createCipheriv, createDecipheriv, createHash, pbkdf2Sync } from 'crypto'
import { logger } from '@/lib/logger.js'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

/**
 * 暗号化キーを取得（環境変数から）
 * 未設定時はDATABASE_URLのハッシュをフォールバックに使用
 */
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY
  if (key) {
    // 64 hex文字 = 32バイトを想定
    if (key.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
    }
    return Buffer.from(key, 'hex')
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY must be set in production environment')
  }

  logger.warn('ENCRYPTION_KEY not set, using DATABASE_URL KDF fallback', { component: 'crypto' })

  // フォールバック: DATABASE_URLからPBKDF2でキーを導出
  // ソルトはDATABASE_URLのSHA-256ハッシュで導出（インストールごとにユニーク）
  const dbUrl = process.env.DATABASE_URL || 'default-key-seed'
  const salt = createHash('sha256').update(dbUrl).digest('hex').slice(0, 32)
  return pbkdf2Sync(dbUrl, salt, 100000, 32, 'sha512')
}

/**
 * 文字列をAES-256-GCMで暗号化
 * @param {string} plaintext - 平文
 * @returns {string} - "iv:encrypted:tag" 形式のhex文字列
 */
export function encrypt(plaintext) {
  if (!plaintext) return null

  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag().toString('hex')

  return `${iv.toString('hex')}:${encrypted}:${tag}`
}

/**
 * AES-256-GCM暗号文を復号
 * @param {string} ciphertext - "iv:encrypted:tag" 形式のhex文字列
 * @returns {string} - 平文
 */
export function decrypt(ciphertext) {
  if (!ciphertext) return null

  try {
    const key = getEncryptionKey()
    const parts = ciphertext.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format')
    }
    const [ivHex, encryptedHex, tagHex] = parts

    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch {
    throw new Error('Decryption failed')
  }
}
