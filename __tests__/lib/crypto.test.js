import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// 各テストで新鮮なモジュールを使うためdynamic import
async function loadCrypto() {
  // モジュールキャッシュをクリアして環境変数変更を反映
  const mod = await import('@/lib/crypto.js')
  return mod
}

describe('crypto', () => {
  const VALID_KEY = 'a'.repeat(64) // 32byte hex

  describe('with ENCRYPTION_KEY set', () => {
    beforeEach(() => {
      process.env.ENCRYPTION_KEY = VALID_KEY
    })

    afterEach(() => {
      delete process.env.ENCRYPTION_KEY
    })

    it('encrypt -> decrypt round trip succeeds', async () => {
      const { encrypt, decrypt } = await loadCrypto()
      const plaintext = 'Hello, World! 日本語テスト'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('encrypt(null) returns null', async () => {
      const { encrypt } = await loadCrypto()
      expect(encrypt(null)).toBeNull()
    })

    it('decrypt(null) returns null', async () => {
      const { decrypt } = await loadCrypto()
      expect(decrypt(null)).toBeNull()
    })

    it('ciphertext format is "iv:encrypted:tag"', async () => {
      const { encrypt } = await loadCrypto()
      const encrypted = encrypt('test data')
      const parts = encrypted.split(':')
      expect(parts).toHaveLength(3)
      // Each part should be hex
      for (const part of parts) {
        expect(part).toMatch(/^[0-9a-f]+$/)
      }
    })
  })

  describe('production without ENCRYPTION_KEY', () => {
    const originalNodeEnv = process.env.NODE_ENV

    beforeEach(() => {
      delete process.env.ENCRYPTION_KEY
      process.env.NODE_ENV = 'production'
    })

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv
    })

    it('encrypt() throws error', async () => {
      const { encrypt } = await loadCrypto()
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be set in production environment')
    })
  })

  describe('development without ENCRYPTION_KEY', () => {
    const originalNodeEnv = process.env.NODE_ENV

    beforeEach(() => {
      delete process.env.ENCRYPTION_KEY
      process.env.NODE_ENV = 'development'
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb'
    })

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv
      delete process.env.DATABASE_URL
    })

    it('encrypt() succeeds with DATABASE_URL hash fallback', async () => {
      const { encrypt, decrypt } = await loadCrypto()
      const plaintext = 'fallback test'
      const encrypted = encrypt(plaintext)
      expect(encrypted).toBeTruthy()
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })
  })
})
