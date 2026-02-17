import { describe, it, expect, vi, beforeEach } from 'vitest'

const findManyMock = vi.fn()
const createMock = vi.fn()
const findUniqueMock = vi.fn()
const updateMock = vi.fn()

vi.mock('@/lib/prisma.js', () => ({
  prisma: {
    memory: {
      findMany: findManyMock,
      create: createMock,
      findUnique: findUniqueMock,
      update: updateMock,
    },
  },
}))

const bunjinSelect = {
  select: {
    id: true,
    slug: true,
    displayName: true,
  },
}

describe('listMemories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ユーザーのメモリー一覧を新しい順で返す', async () => {
    const mockMemories = [
      { id: 'm1', text: 'メモリー1', bunjin: null },
      { id: 'm2', text: 'メモリー2', bunjin: { id: 'b1', slug: 'work', displayName: '仕事' } },
    ]
    findManyMock.mockResolvedValue(mockMemories)

    const { listMemories } = await import('@/lib/services/memory-service.js')
    const result = await listMemories('user-1')

    expect(result).toEqual(mockMemories)
    expect(findManyMock).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { bunjin: bunjinSelect },
    })
  })

  it('userIdが未指定の場合はValidationErrorをスローする', async () => {
    const { listMemories } = await import('@/lib/services/memory-service.js')

    await expect(listMemories('')).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'userId is required',
    })
  })

  it('limitを指定して取得件数を制限できる', async () => {
    findManyMock.mockResolvedValue([])

    const { listMemories } = await import('@/lib/services/memory-service.js')
    await listMemories('user-1', { limit: 10 })

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    )
  })
})

describe('createMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('有効なデータでメモリーを作成する', async () => {
    const created = {
      id: 'm-new',
      userId: 'user-1',
      text: '新しいメモリー',
      bunjinId: null,
      sourceRefs: '[]',
    }
    createMock.mockResolvedValue(created)

    const { createMemory } = await import('@/lib/services/memory-service.js')
    const result = await createMemory('user-1', { text: '新しいメモリー' })

    expect(result).toEqual(created)
    expect(createMock).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        text: '新しいメモリー',
        bunjinId: null,
        sourceRefs: '[]',
      },
      include: { bunjin: bunjinSelect },
    })
  })

  it('bunjinIdを指定してメモリーを作成する', async () => {
    createMock.mockResolvedValue({
      id: 'm-new',
      bunjinId: 'b1',
    })

    const { createMemory } = await import('@/lib/services/memory-service.js')
    await createMemory('user-1', { text: 'テスト', bunjinId: 'b1' })

    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ bunjinId: 'b1' }),
      include: { bunjin: bunjinSelect },
    })
  })

  it('userIdが未指定の場合はValidationErrorをスローする', async () => {
    const { createMemory } = await import('@/lib/services/memory-service.js')

    await expect(
      createMemory('', { text: 'テスト' })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'userId is required',
    })
  })
})

describe('updateMemoryText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('メモリーのテキストを更新する', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'm1',
      userId: 'user-1',
      text: '古いテキスト',
    })
    const updated = {
      id: 'm1',
      text: '更新されたテキスト',
    }
    updateMock.mockResolvedValue(updated)

    const { updateMemoryText } = await import(
      '@/lib/services/memory-service.js'
    )
    const result = await updateMemoryText('user-1', 'm1', '更新されたテキスト')

    expect(result).toEqual(updated)
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { text: '更新されたテキスト' },
      include: { bunjin: bunjinSelect },
    })
  })

  it('存在しないメモリーの更新はNotFoundErrorをスローする', async () => {
    findUniqueMock.mockResolvedValue(null)

    const { updateMemoryText } = await import(
      '@/lib/services/memory-service.js'
    )

    await expect(
      updateMemoryText('user-1', 'nonexistent', '新テキスト')
    ).rejects.toMatchObject({
      name: 'NotFoundError',
      message: 'Memory not found: nonexistent',
    })
  })
})
