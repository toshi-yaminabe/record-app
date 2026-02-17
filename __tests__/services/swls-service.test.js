import { describe, it, expect, vi, beforeEach } from 'vitest'

const findUniqueMock = vi.fn()
const upsertMock = vi.fn()

vi.mock('@/lib/prisma.js', () => ({
  prisma: {
    swlsResponse: {
      findUnique: findUniqueMock,
      upsert: upsertMock,
    },
  },
}))

describe('getSwlsResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('指定日のSWLS回答を返す', async () => {
    const mockResponse = {
      id: 'swls-1',
      userId: 'user-1',
      dateKey: '2026-02-17',
      q1: '回答1',
    }
    findUniqueMock.mockResolvedValue(mockResponse)

    const { getSwlsResponse } = await import(
      '@/lib/services/swls-service.js'
    )
    const result = await getSwlsResponse('user-1', '2026-02-17')

    expect(result).toEqual(mockResponse)
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: {
        userId_dateKey: { userId: 'user-1', dateKey: '2026-02-17' },
      },
    })
  })

  it('回答が無い場合はnullを返す', async () => {
    findUniqueMock.mockResolvedValue(null)

    const { getSwlsResponse } = await import(
      '@/lib/services/swls-service.js'
    )
    const result = await getSwlsResponse('user-1', '2026-02-17')

    expect(result).toBeNull()
  })

  it('不正なdateKey形式の場合はValidationErrorをスローする', async () => {
    const { getSwlsResponse } = await import(
      '@/lib/services/swls-service.js'
    )

    await expect(
      getSwlsResponse('user-1', 'invalid-date')
    ).rejects.toMatchObject({
      name: 'ValidationError',
      message: expect.stringContaining('Invalid dateKey format'),
    })
  })

  it('userIdが未指定の場合はValidationErrorをスローする', async () => {
    const { getSwlsResponse } = await import(
      '@/lib/services/swls-service.js'
    )

    await expect(getSwlsResponse('', '2026-02-17')).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'userId is required',
    })
  })
})

describe('upsertSwlsResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('新規SWLS回答を作成する', async () => {
    const upserted = {
      id: 'swls-new',
      userId: 'user-1',
      dateKey: '2026-02-17',
      q1: '満足',
      q2: '充実',
    }
    upsertMock.mockResolvedValue(upserted)

    const { upsertSwlsResponse } = await import(
      '@/lib/services/swls-service.js'
    )
    const result = await upsertSwlsResponse('user-1', {
      dateKey: '2026-02-17',
      q1: '満足',
      q2: '充実',
    })

    expect(result).toEqual(upserted)
    expect(upsertMock).toHaveBeenCalledWith({
      where: {
        userId_dateKey: { userId: 'user-1', dateKey: '2026-02-17' },
      },
      create: {
        userId: 'user-1',
        dateKey: '2026-02-17',
        q1: '満足',
        q2: '充実',
      },
      update: {
        q1: '満足',
        q2: '充実',
      },
    })
  })

  it('既存のSWLS回答を更新する', async () => {
    const upserted = {
      id: 'swls-1',
      userId: 'user-1',
      dateKey: '2026-02-17',
      q3: '更新済み',
    }
    upsertMock.mockResolvedValue(upserted)

    const { upsertSwlsResponse } = await import(
      '@/lib/services/swls-service.js'
    )
    const result = await upsertSwlsResponse('user-1', {
      dateKey: '2026-02-17',
      q3: '更新済み',
    })

    expect(result).toEqual(upserted)
  })

  it('不正なdateKey形式の場合はValidationErrorをスローする', async () => {
    const { upsertSwlsResponse } = await import(
      '@/lib/services/swls-service.js'
    )

    await expect(
      upsertSwlsResponse('user-1', { dateKey: 'not-a-date', q1: '回答' })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      message: expect.stringContaining('Invalid dateKey format'),
    })
  })

  it('回答値が500文字を超える場合はValidationErrorをスローする', async () => {
    const longText = 'a'.repeat(501)

    const { upsertSwlsResponse } = await import(
      '@/lib/services/swls-service.js'
    )

    await expect(
      upsertSwlsResponse('user-1', { dateKey: '2026-02-17', q1: longText })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      message: expect.stringContaining('q1 must be a string of max 500 characters'),
    })
  })
})
