import { describe, it, expect, vi, beforeEach } from 'vitest'

const segmentUpsertMock = vi.fn()
const sessionFindFirstMock = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    segment: {
      upsert: segmentUpsertMock,
    },
    session: {
      findFirst: sessionFindFirstMock,
    },
  },
}))

describe('createLocalSegment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('有効なデータでローカルセグメントを作成する (SERVER mode)', async () => {
    sessionFindFirstMock.mockResolvedValue({ id: 's1', userId: 'user-1' })
    const created = {
      id: 'seg-new',
      sessionId: 's1',
      segmentNo: 0,
      text: 'こんにちは',
      sttStatus: 'DONE',
      selectedMode: 'SERVER',
      executedMode: 'SERVER',
    }
    segmentUpsertMock.mockResolvedValue(created)

    const { createLocalSegment } = await import(
      '@/lib/services/local-segment-service.js'
    )
    const result = await createLocalSegment('user-1', {
      sessionId: 's1',
      segmentNo: 0,
      startAt: '2026-02-17T10:00:00Z',
      endAt: '2026-02-17T10:05:00Z',
      text: 'こんにちは',
      selectedMode: 'SERVER',
      executedMode: 'SERVER',
    })

    expect(result).toEqual(created)
    expect(sessionFindFirstMock).toHaveBeenCalledWith({
      where: { id: 's1', userId: 'user-1' },
    })
    expect(segmentUpsertMock).toHaveBeenCalledWith({
      where: {
        sessionId_segmentNo: { sessionId: 's1', segmentNo: 0 },
      },
      update: {
        startAt: expect.any(Date),
        endAt: expect.any(Date),
        text: 'こんにちは',
        sttStatus: 'DONE',
        selectedMode: 'SERVER',
        executedMode: 'SERVER',
        fallbackReason: null,
        localEngineVersion: null,
      },
      create: {
        sessionId: 's1',
        userId: 'user-1',
        segmentNo: 0,
        startAt: expect.any(Date),
        endAt: expect.any(Date),
        text: 'こんにちは',
        sttStatus: 'DONE',
        selectedMode: 'SERVER',
        executedMode: 'SERVER',
        fallbackReason: null,
        localEngineVersion: null,
      },
    })
  })

  it('LOCAL mode + フォールバックでセグメントを作成する', async () => {
    sessionFindFirstMock.mockResolvedValue({ id: 's1', userId: 'user-1' })
    segmentUpsertMock.mockResolvedValue({
      id: 'seg-new',
      selectedMode: 'LOCAL',
      executedMode: 'SERVER',
      fallbackReason: 'model not available',
    })

    const { createLocalSegment } = await import(
      '@/lib/services/local-segment-service.js'
    )
    await createLocalSegment('user-1', {
      sessionId: 's1',
      segmentNo: 1,
      startAt: '2026-02-17T10:00:00Z',
      endAt: '2026-02-17T10:05:00Z',
      text: 'テスト',
      selectedMode: 'LOCAL',
      executedMode: 'SERVER',
      fallbackReason: 'model not available',
    })

    expect(segmentUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          selectedMode: 'LOCAL',
          executedMode: 'SERVER',
          fallbackReason: 'model not available',
        }),
      })
    )
  })

  it('LOCAL mode + localEngineVersionでセグメントを作成する', async () => {
    sessionFindFirstMock.mockResolvedValue({ id: 's1', userId: 'user-1' })
    segmentUpsertMock.mockResolvedValue({ id: 'seg-new' })

    const { createLocalSegment } = await import(
      '@/lib/services/local-segment-service.js'
    )
    await createLocalSegment('user-1', {
      sessionId: 's1',
      segmentNo: 2,
      startAt: '2026-02-17T10:00:00Z',
      endAt: '2026-02-17T10:05:00Z',
      text: 'ローカルテスト',
      selectedMode: 'LOCAL',
      executedMode: 'LOCAL',
      localEngineVersion: 'whisper-1.0.0',
    })

    expect(segmentUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          localEngineVersion: 'whisper-1.0.0',
        }),
      })
    )
  })

  it('userIdが未指定の場合はValidationErrorをスローする', async () => {
    const { createLocalSegment } = await import(
      '@/lib/services/local-segment-service.js'
    )

    await expect(
      createLocalSegment('', {
        sessionId: 's1',
        segmentNo: 0,
        startAt: '2026-02-17T10:00:00Z',
        endAt: '2026-02-17T10:05:00Z',
        text: 'test',
        selectedMode: 'SERVER',
        executedMode: 'SERVER',
      })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'userId is required',
    })
  })

  it('sessionIdが未指定の場合はValidationErrorをスローする', async () => {
    const { createLocalSegment } = await import(
      '@/lib/services/local-segment-service.js'
    )

    await expect(
      createLocalSegment('user-1', {
        segmentNo: 0,
        startAt: '2026-02-17T10:00:00Z',
        endAt: '2026-02-17T10:05:00Z',
        text: 'test',
        selectedMode: 'SERVER',
        executedMode: 'SERVER',
      })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'sessionId is required',
    })
  })

  it('textが未指定の場合はValidationErrorをスローする', async () => {
    const { createLocalSegment } = await import(
      '@/lib/services/local-segment-service.js'
    )

    await expect(
      createLocalSegment('user-1', {
        sessionId: 's1',
        segmentNo: 0,
        startAt: '2026-02-17T10:00:00Z',
        endAt: '2026-02-17T10:05:00Z',
        selectedMode: 'SERVER',
        executedMode: 'SERVER',
      })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'text is required',
    })
  })

  it('存在しないセッションの場合はNotFoundErrorをスローする', async () => {
    sessionFindFirstMock.mockResolvedValue(null)

    const { createLocalSegment } = await import(
      '@/lib/services/local-segment-service.js'
    )

    await expect(
      createLocalSegment('user-1', {
        sessionId: 'nonexistent',
        segmentNo: 0,
        startAt: '2026-02-17T10:00:00Z',
        endAt: '2026-02-17T10:05:00Z',
        text: 'test',
        selectedMode: 'SERVER',
        executedMode: 'SERVER',
      })
    ).rejects.toMatchObject({
      name: 'NotFoundError',
      message: 'Session not found: nonexistent',
    })
  })
})
