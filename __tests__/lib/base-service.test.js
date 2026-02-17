import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ValidationError, NotFoundError } from '@/lib/errors.js'

// prisma モジュールをモック（base-service が import している）
vi.mock('@/lib/prisma.js', () => ({
  prisma: {},
}))

import { requireUserId, findOwnedOrThrow } from '@/lib/services/base-service.js'

describe('requireUserId', () => {
  it('有効な userId では例外を投げない', () => {
    expect(() => requireUserId('user-123')).not.toThrow()
  })

  it('null の場合 ValidationError を投げる', () => {
    expect(() => requireUserId(null)).toThrow(ValidationError)
    expect(() => requireUserId(null)).toThrow('userId is required')
  })

  it('undefined の場合 ValidationError を投げる', () => {
    expect(() => requireUserId(undefined)).toThrow(ValidationError)
  })

  it('空文字の場合 ValidationError を投げる', () => {
    expect(() => requireUserId('')).toThrow(ValidationError)
    expect(() => requireUserId('')).toThrow('userId is required')
  })
})

describe('findOwnedOrThrow', () => {
  let mockModel

  beforeEach(() => {
    mockModel = {
      findUnique: vi.fn(),
    }
  })

  it('所有レコードが見つかった場合そのレコードを返す', async () => {
    const record = { id: 'rec-1', userId: 'user-1', title: 'Test' }
    mockModel.findUnique.mockResolvedValue(record)

    const result = await findOwnedOrThrow(mockModel, 'rec-1', 'user-1', 'Task')

    expect(result).toEqual(record)
    expect(mockModel.findUnique).toHaveBeenCalledWith({ where: { id: 'rec-1' } })
  })

  it('レコードが存在しない場合 NotFoundError を投げる', async () => {
    mockModel.findUnique.mockResolvedValue(null)

    await expect(
      findOwnedOrThrow(mockModel, 'rec-999', 'user-1', 'Bunjin')
    ).rejects.toThrow(NotFoundError)

    await expect(
      findOwnedOrThrow(mockModel, 'rec-999', 'user-1', 'Bunjin')
    ).rejects.toThrow('Bunjin not found: rec-999')
  })

  it('userId が一致しない場合 NotFoundError を投げる', async () => {
    const record = { id: 'rec-1', userId: 'other-user', title: 'Secret' }
    mockModel.findUnique.mockResolvedValue(record)

    await expect(
      findOwnedOrThrow(mockModel, 'rec-1', 'user-1', 'Session')
    ).rejects.toThrow(NotFoundError)

    await expect(
      findOwnedOrThrow(mockModel, 'rec-1', 'user-1', 'Session')
    ).rejects.toThrow('Session not found: rec-1')
  })
})
