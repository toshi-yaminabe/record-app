import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto'

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
    // 32バイトのhex文字列を想定
    return Buffer.from(key, 'hex')
  }

  // フォールバック: DATABASE_URLからキーを導出
  const dbUrl = process.env.DATABASE_URL || 'default-key-seed'
  return createHash('sha256').update(dbUrl).digest()
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

  const key = getEncryptionKey()
  const [ivHex, encryptedHex, tagHex] = ciphertext.split(':')

  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
