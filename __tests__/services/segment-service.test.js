import { describe, it, expect, vi, beforeEach } from 'vitest'

const segmentFindManyMock = vi.fn()
const segmentUpsertMock = vi.fn()
const segmentFindFirstMock = vi.fn()
const segmentUpdateMock = vi.fn()
const sessionFindFirstMock = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    segment: {
      findMany: segmentFindManyMock,
      upsert: segmentUpsertMock,
      findFirst: segmentFindFirstMock,
      update: segmentUpdateMock,
    },
    session: {
      findFirst: sessionFindFirstMock,
    },
  },
}))

describe('listSegments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ユーザーの全セグメントを返す', async () => {
    const mockSegments = [
      { id: 'seg1', segmentNo: 0, sessionId: 's1' },
      { id: 'seg2', segmentNo: 1, sessionId: 's1' },
    ]
    segmentFindManyMock.mockResolvedValue(mockSegments)

    const { listSegments } = await import(
      '@/lib/services/segment-service.js'
    )
    const result = await listSegments('user-1')

    expect(result).toEqual(mockSegments)
    expect(segmentFindManyMock).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: [{ sessionId: 'desc' }, { segmentNo: 'asc' }],
      take: 100,
      include: { bunjin: true },
    })
  })

  it('sessionIdでフィルタリングできる', async () => {
    segmentFindManyMock.mockResolvedValue([])

    const { listSegments } = await import(
      '@/lib/services/segment-service.js'
    )
    await listSegments('user-1', { sessionId: 's1' })

    expect(segmentFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', sessionId: 's1' },
      })
    )
  })

  it('userIdが未指定の場合はValidationErrorをスローする', async () => {
    const { listSegments } = await import(
      '@/lib/services/segment-service.js'
    )

    await expect(listSegments('')).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'userId is required',
    })
  })
})

describe('createSegment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('有効なデータでセグメントを作成する', async () => {
    sessionFindFirstMock.mockResolvedValue({
      id: 's1',
      userId: 'user-1',
    })
    const created = {
      id: 'seg-new',
      sessionId: 's1',
      segmentNo: 0,
      sttStatus: 'PENDING',
    }
    segmentUpsertMock.mockResolvedValue(created)

    const { createSegment } = await import(
      '@/lib/services/segment-service.js'
    )
    const result = await createSegment('user-1', {
      sessionId: 's1',
      segmentNo: 0,
      startAt: '2026-02-17T10:00:00Z',
      endAt: '2026-02-17T10:05:00Z',
    })

    expect(result).toEqual(created)
    expect(segmentUpsertMock).toHaveBeenCalledWith({
      where: {
        sessionId_segmentNo: { sessionId: 's1', segmentNo: 0 },
      },
      update: {
        startAt: expect.any(Date),
        endAt: expect.any(Date),
        storageObjectPath: null,
      },
      create: {
        sessionId: 's1',
        userId: 'user-1',
        segmentNo: 0,
        startAt: expect.any(Date),
        endAt: expect.any(Date),
        sttStatus: 'PENDING',
        storageObjectPath: null,
      },
    })
  })

  it('sessionIdが未指定の場合はValidationErrorをスローする', async () => {
    const { createSegment } = await import(
      '@/lib/services/segment-service.js'
    )

    await expect(
      createSegment('user-1', { segmentNo: 0 })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'sessionId is required',
    })
  })

  it('segmentNoが未指定の場合はValidationErrorをスローする', async () => {
    const { createSegment } = await import(
      '@/lib/services/segment-service.js'
    )

    await expect(
      createSegment('user-1', { sessionId: 's1' })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'segmentNo is required',
    })
  })

  it('存在しないセッションの場合はNotFoundErrorをスローする', async () => {
    sessionFindFirstMock.mockResolvedValue(null)

    const { createSegment } = await import(
      '@/lib/services/segment-service.js'
    )

    await expect(
      createSegment('user-1', {
        sessionId: 'nonexistent',
        segmentNo: 0,
        startAt: '2026-02-17T10:00:00Z',
        endAt: '2026-02-17T10:05:00Z',
      })
    ).rejects.toMatchObject({
      name: 'NotFoundError',
      message: 'Session not found: nonexistent',
    })
  })
})

describe('getSegment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('セグメント詳細を返す', async () => {
    const mockSegment = {
      id: 'seg1',
      userId: 'user-1',
      segmentNo: 0,
      bunjin: null,
      session: { id: 's1' },
    }
    segmentFindFirstMock.mockResolvedValue(mockSegment)

    const { getSegment } = await import('@/lib/services/segment-service.js')
    const result = await getSegment('user-1', 'seg1')

    expect(result).toEqual(mockSegment)
    expect(segmentFindFirstMock).toHaveBeenCalledWith({
      where: { id: 'seg1', userId: 'user-1' },
      include: { bunjin: true, session: true },
    })
  })

  it('存在しないセグメントはNotFoundErrorをスローする', async () => {
    segmentFindFirstMock.mockResolvedValue(null)

    const { getSegment } = await import('@/lib/services/segment-service.js')

    await expect(getSegment('user-1', 'nonexistent')).rejects.toMatchObject({
      name: 'NotFoundError',
      message: 'Segment not found: nonexistent',
    })
  })
})

describe('updateSegmentSttStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('STTステータスを更新する', async () => {
    segmentFindFirstMock.mockResolvedValue({
      id: 'seg1',
      userId: 'user-1',
      sttStatus: 'PENDING',
    })
    segmentUpdateMock.mockResolvedValue({
      id: 'seg1',
      sttStatus: 'DONE',
      text: 'こんにちは',
    })

    const { updateSegmentSttStatus } = await import(
      '@/lib/services/segment-service.js'
    )
    const result = await updateSegmentSttStatus('user-1', 'seg1', {
      sttStatus: 'DONE',
      text: 'こんにちは',
    })

    expect(result.sttStatus).toBe('DONE')
    expect(segmentUpdateMock).toHaveBeenCalledWith({
      where: { id: 'seg1' },
      data: { sttStatus: 'DONE', text: 'こんにちは' },
    })
  })

  it('不正なSTTステータスはValidationErrorをスローする', async () => {
    segmentFindFirstMock.mockResolvedValue({
      id: 'seg1',
      userId: 'user-1',
    })

    const { updateSegmentSttStatus } = await import(
      '@/lib/services/segment-service.js'
    )

    await expect(
      updateSegmentSttStatus('user-1', 'seg1', { sttStatus: 'INVALID' })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'Invalid STT status: INVALID',
    })
  })

  it('存在しないセグメントはNotFoundErrorをスローする', async () => {
    segmentFindFirstMock.mockResolvedValue(null)

    const { updateSegmentSttStatus } = await import(
      '@/lib/services/segment-service.js'
    )

    await expect(
      updateSegmentSttStatus('user-1', 'nonexistent', { sttStatus: 'DONE' })
    ).rejects.toMatchObject({
      name: 'NotFoundError',
      message: 'Segment not found: nonexistent',
    })
  })
})
