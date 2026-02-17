import { describe, it, expect, vi, beforeEach } from 'vitest'

const sessionFindManyMock = vi.fn()
const sessionCreateMock = vi.fn()
const sessionFindFirstMock = vi.fn()
const sessionUpdateMock = vi.fn()
const publishedVersionFindFirstMock = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    session: {
      findMany: sessionFindManyMock,
      create: sessionCreateMock,
      findFirst: sessionFindFirstMock,
      update: sessionUpdateMock,
    },
    publishedVersion: {
      findFirst: publishedVersionFindFirstMock,
    },
  },
}))

describe('createSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deviceIdを指定してACTIVEセッションを作成する', async () => {
    publishedVersionFindFirstMock.mockResolvedValue({
      id: 'rv-1',
      version: 1,
    })
    const created = {
      id: 's-new',
      userId: 'user-1',
      deviceId: 'device-abc',
      status: 'ACTIVE',
      ruleVersionId: 'rv-1',
    }
    sessionCreateMock.mockResolvedValue(created)

    const { createSession } = await import(
      '@/lib/services/session-service.js'
    )
    const result = await createSession('user-1', { deviceId: 'device-abc' })

    expect(result).toEqual(created)
    expect(sessionCreateMock).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        deviceId: 'device-abc',
        status: 'ACTIVE',
        ruleVersionId: 'rv-1',
      },
    })
  })

  it('publishedVersionが無い場合もruleVersionId nullで作成する', async () => {
    publishedVersionFindFirstMock.mockResolvedValue(null)
    sessionCreateMock.mockResolvedValue({
      id: 's-new',
      ruleVersionId: null,
    })

    const { createSession } = await import(
      '@/lib/services/session-service.js'
    )
    const result = await createSession('user-1', { deviceId: 'device-abc' })

    expect(result.ruleVersionId).toBeNull()
    expect(sessionCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ ruleVersionId: null }),
    })
  })

  it('userIdが未指定の場合はValidationErrorをスローする', async () => {
    const { createSession } = await import(
      '@/lib/services/session-service.js'
    )

    await expect(
      createSession('', { deviceId: 'device-abc' })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'userId is required',
    })
  })
})

describe('listSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ユーザーのセッション一覧を新しい順で返す', async () => {
    const mockSessions = [
      { id: 's1', status: 'ACTIVE', _count: { segments: 3 } },
      { id: 's2', status: 'STOPPED', _count: { segments: 5 } },
    ]
    sessionFindManyMock.mockResolvedValue(mockSessions)

    const { listSessions } = await import(
      '@/lib/services/session-service.js'
    )
    const result = await listSessions('user-1')

    expect(result).toEqual(mockSessions)
    expect(sessionFindManyMock).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: {
        _count: { select: { segments: true } },
      },
    })
  })

  it('limitを指定して取得件数を制限できる', async () => {
    sessionFindManyMock.mockResolvedValue([])

    const { listSessions } = await import(
      '@/lib/services/session-service.js'
    )
    await listSessions('user-1', { limit: 10 })

    expect(sessionFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    )
  })
})

describe('getSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('セッション詳細をセグメント付きで返す', async () => {
    const mockSession = {
      id: 's1',
      userId: 'user-1',
      status: 'ACTIVE',
      segments: [{ id: 'seg1', segmentNo: 0 }],
    }
    sessionFindFirstMock.mockResolvedValue(mockSession)

    const { getSession } = await import('@/lib/services/session-service.js')
    const result = await getSession('user-1', 's1')

    expect(result).toEqual(mockSession)
    expect(sessionFindFirstMock).toHaveBeenCalledWith({
      where: { id: 's1', userId: 'user-1' },
      include: {
        segments: { orderBy: { segmentNo: 'asc' } },
        ruleVersion: true,
      },
    })
  })

  it('存在しないセッションはNotFoundErrorをスローする', async () => {
    sessionFindFirstMock.mockResolvedValue(null)

    const { getSession } = await import('@/lib/services/session-service.js')

    await expect(getSession('user-1', 'nonexistent')).rejects.toMatchObject({
      name: 'NotFoundError',
      message: 'Session not found: nonexistent',
    })
  })
})

describe('stopSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ACTIVEセッションをSTOPPEDに変更する', async () => {
    sessionFindFirstMock.mockResolvedValue({
      id: 's1',
      userId: 'user-1',
      status: 'ACTIVE',
    })
    const stopped = {
      id: 's1',
      status: 'STOPPED',
      endedAt: new Date(),
    }
    sessionUpdateMock.mockResolvedValue(stopped)

    const { stopSession } = await import('@/lib/services/session-service.js')
    const result = await stopSession('user-1', 's1')

    expect(result.status).toBe('STOPPED')
    expect(sessionUpdateMock).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: {
        status: 'STOPPED',
        endedAt: expect.any(Date),
      },
    })
  })

  it('存在しないセッションの停止はNotFoundErrorをスローする', async () => {
    sessionFindFirstMock.mockResolvedValue(null)

    const { stopSession } = await import('@/lib/services/session-service.js')

    await expect(stopSession('user-1', 'nonexistent')).rejects.toMatchObject({
      name: 'NotFoundError',
      message: 'Session not found: nonexistent',
    })
  })
})
