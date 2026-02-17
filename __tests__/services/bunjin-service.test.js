import { describe, it, expect, vi, beforeEach } from 'vitest'

const findManyMock = vi.fn()
const countMock = vi.fn()
const findUniqueMock = vi.fn()
const createMock = vi.fn()
const updateMock = vi.fn()
const deleteMock = vi.fn()

vi.mock('@/lib/prisma.js', () => ({
  prisma: {
    bunjin: {
      findMany: findManyMock,
      count: countMock,
      findUnique: findUniqueMock,
      create: createMock,
      update: updateMock,
      delete: deleteMock,
    },
  },
}))

describe('listBunjins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ユーザーの全分人をデフォルト優先・作成日順で返す', async () => {
    const mockBunjins = [
      { id: 'b1', slug: 'work', displayName: '仕事モード', isDefault: true },
      { id: 'b2', slug: 'custom-1', displayName: 'カスタム1', isDefault: false },
    ]
    findManyMock.mockResolvedValue(mockBunjins)

    const { listBunjins } = await import('@/lib/services/bunjin-service.js')
    const result = await listBunjins('user-1')

    expect(result).toEqual(mockBunjins)
    expect(findManyMock).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })
  })

  it('userIdが未指定の場合はValidationErrorをスローする', async () => {
    const { listBunjins } = await import('@/lib/services/bunjin-service.js')

    await expect(listBunjins('')).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'userId is required',
    })
  })
})

describe('createBunjin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('有効なデータでカスタム分人を作成する', async () => {
    countMock.mockResolvedValue(0)
    findUniqueMock.mockResolvedValue(null)
    const created = {
      id: 'b-new',
      userId: 'user-1',
      slug: 'my-bunjin',
      displayName: 'マイ分人',
      description: '',
      color: '#6366f1',
      icon: 'person',
      isDefault: false,
    }
    createMock.mockResolvedValue(created)

    const { createBunjin } = await import('@/lib/services/bunjin-service.js')
    const result = await createBunjin('user-1', {
      slug: 'my-bunjin',
      displayName: 'マイ分人',
    })

    expect(result).toEqual(created)
    expect(createMock).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        slug: 'my-bunjin',
        displayName: 'マイ分人',
        description: '',
        color: '#6366f1',
        icon: 'person',
        isDefault: false,
      },
    })
  })

  it('slugが未指定の場合はValidationErrorをスローする', async () => {
    const { createBunjin } = await import('@/lib/services/bunjin-service.js')

    await expect(
      createBunjin('user-1', { displayName: 'テスト' })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'slug and displayName are required',
    })
  })

  it('不正なslug形式の場合はValidationErrorをスローする', async () => {
    const { createBunjin } = await import('@/lib/services/bunjin-service.js')

    await expect(
      createBunjin('user-1', { slug: 'INVALID SLUG!', displayName: 'テスト' })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'slug must be lowercase alphanumeric with hyphens',
    })
  })

  it('カスタム分人が3つ以上の場合はConflictErrorをスローする', async () => {
    countMock.mockResolvedValue(3)

    const { createBunjin } = await import('@/lib/services/bunjin-service.js')

    await expect(
      createBunjin('user-1', { slug: 'new-one', displayName: '新しい' })
    ).rejects.toMatchObject({
      name: 'ConflictError',
      message: 'Maximum 3 custom bunjins allowed',
    })
  })

  it('同じslugが既に存在する場合はConflictErrorをスローする', async () => {
    countMock.mockResolvedValue(0)
    findUniqueMock.mockResolvedValue({ id: 'existing', slug: 'dup' })

    const { createBunjin } = await import('@/lib/services/bunjin-service.js')

    await expect(
      createBunjin('user-1', { slug: 'dup', displayName: '重複' })
    ).rejects.toMatchObject({
      name: 'ConflictError',
      message: 'Bunjin with slug "dup" already exists',
    })
  })
})

describe('updateBunjin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('有効なデータで分人を更新する', async () => {
    const existing = {
      id: 'b1',
      userId: 'user-1',
      slug: 'custom-1',
      isDefault: false,
    }
    findUniqueMock.mockResolvedValue(existing)
    const updated = { ...existing, displayName: '更新済み' }
    updateMock.mockResolvedValue(updated)

    const { updateBunjin } = await import('@/lib/services/bunjin-service.js')
    const result = await updateBunjin('user-1', 'b1', {
      displayName: '更新済み',
    })

    expect(result).toEqual(updated)
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { displayName: '更新済み' },
    })
  })

  it('デフォルト分人のslugを変更しようとするとValidationErrorをスローする', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'b1',
      userId: 'user-1',
      slug: 'work',
      isDefault: true,
    })

    const { updateBunjin } = await import('@/lib/services/bunjin-service.js')

    await expect(
      updateBunjin('user-1', 'b1', { slug: 'new-slug' })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'Cannot change slug of default bunjin',
    })
  })

  it('不正なcolor形式の場合はValidationErrorをスローする', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'b1',
      userId: 'user-1',
      slug: 'custom-1',
      isDefault: false,
    })

    const { updateBunjin } = await import('@/lib/services/bunjin-service.js')

    await expect(
      updateBunjin('user-1', 'b1', { color: 'not-a-color' })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'color must be a valid hex color (e.g. #ff00aa)',
    })
  })

  it('slug変更時に重複がある場合はConflictErrorをスローする', async () => {
    // findOwnedOrThrow用（最初の呼び出し）
    findUniqueMock.mockResolvedValueOnce({
      id: 'b1',
      userId: 'user-1',
      slug: 'old-slug',
      isDefault: false,
    })
    // slug重複チェック用（2回目の呼び出し）
    findUniqueMock.mockResolvedValueOnce({
      id: 'b2',
      slug: 'taken-slug',
    })

    const { updateBunjin } = await import('@/lib/services/bunjin-service.js')

    await expect(
      updateBunjin('user-1', 'b1', { slug: 'taken-slug' })
    ).rejects.toMatchObject({
      name: 'ConflictError',
      message: 'Bunjin with slug "taken-slug" already exists',
    })
  })
})

describe('deleteBunjin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('カスタム分人を正常に削除する', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'b1',
      userId: 'user-1',
      isDefault: false,
    })
    deleteMock.mockResolvedValue({})

    const { deleteBunjin } = await import('@/lib/services/bunjin-service.js')
    await deleteBunjin('user-1', 'b1')

    expect(deleteMock).toHaveBeenCalledWith({ where: { id: 'b1' } })
  })

  it('存在しない分人の削除はNotFoundErrorをスローする', async () => {
    findUniqueMock.mockResolvedValue(null)

    const { deleteBunjin } = await import('@/lib/services/bunjin-service.js')

    await expect(deleteBunjin('user-1', 'nonexistent')).rejects.toMatchObject({
      name: 'NotFoundError',
      message: 'Bunjin not found: nonexistent',
    })
  })

  it('デフォルト分人の削除はValidationErrorをスローする', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'b1',
      userId: 'user-1',
      isDefault: true,
    })

    const { deleteBunjin } = await import('@/lib/services/bunjin-service.js')

    await expect(deleteBunjin('user-1', 'b1')).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'Cannot delete default bunjin',
    })
  })
})
