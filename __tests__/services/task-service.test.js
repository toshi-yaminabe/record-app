import { describe, it, expect, vi, beforeEach } from 'vitest'

const taskFindManyMock = vi.fn()
const taskCreateMock = vi.fn()
const taskFindUniqueMock = vi.fn()
const taskUpdateMock = vi.fn()
const taskUpdateManyMock = vi.fn()
const bunjinFindUniqueMock = vi.fn()

vi.mock('@/lib/prisma.js', () => ({
  prisma: {
    task: {
      findMany: taskFindManyMock,
      create: taskCreateMock,
      findUnique: taskFindUniqueMock,
      update: taskUpdateMock,
      updateMany: taskUpdateManyMock,
    },
    bunjin: {
      findUnique: bunjinFindUniqueMock,
    },
  },
}))

const bunjinSelect = {
  select: {
    id: true,
    slug: true,
    displayName: true,
    color: true,
    icon: true,
  },
}

describe('listTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('フィルターなしで非アーカイブのタスクを返す', async () => {
    const mockTasks = [
      { id: 't1', title: 'タスク1', status: 'TODO', priority: 50 },
    ]
    taskFindManyMock.mockResolvedValue(mockTasks)

    const { listTasks } = await import('@/lib/services/task-service.js')
    const result = await listTasks('user-1')

    expect(result).toEqual(mockTasks)
    expect(taskFindManyMock).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: { not: 'ARCHIVED' } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      include: { bunjin: bunjinSelect },
    })
  })

  it('statusフィルターで絞り込める', async () => {
    taskFindManyMock.mockResolvedValue([])

    const { listTasks } = await import('@/lib/services/task-service.js')
    await listTasks('user-1', { status: 'TODO' })

    expect(taskFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', status: 'TODO' },
      })
    )
  })

  it('bunjinIdフィルターで絞り込める', async () => {
    taskFindManyMock.mockResolvedValue([])

    const { listTasks } = await import('@/lib/services/task-service.js')
    await listTasks('user-1', { bunjinId: 'bunjin-1' })

    expect(taskFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bunjinId: 'bunjin-1' }),
      })
    )
  })

  it('limitを指定できる', async () => {
    taskFindManyMock.mockResolvedValue([])

    const { listTasks } = await import('@/lib/services/task-service.js')
    await listTasks('user-1', { limit: 10 })

    expect(taskFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    )
  })
})

describe('createTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('有効なデータでタスクを作成する', async () => {
    const created = {
      id: 't-new',
      userId: 'user-1',
      title: '新しいタスク',
      body: '',
      status: 'TODO',
      priority: 0,
      bunjinId: null,
    }
    taskCreateMock.mockResolvedValue(created)

    const { createTask } = await import('@/lib/services/task-service.js')
    const result = await createTask('user-1', { title: '新しいタスク' })

    expect(result).toEqual(created)
    expect(taskCreateMock).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        title: '新しいタスク',
        body: '',
        bunjinId: null,
        priority: 0,
        status: 'TODO',
      },
      include: { bunjin: bunjinSelect },
    })
  })

  it('titleが未指定の場合はValidationErrorをスローする', async () => {
    const { createTask } = await import('@/lib/services/task-service.js')

    await expect(createTask('user-1', {})).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'title is required',
    })
  })

  it('bunjinIdが指定され所有権が確認できる場合はタスクを作成する', async () => {
    bunjinFindUniqueMock.mockResolvedValue({
      id: 'bunjin-1',
      userId: 'user-1',
    })
    taskCreateMock.mockResolvedValue({
      id: 't-new',
      bunjinId: 'bunjin-1',
    })

    const { createTask } = await import('@/lib/services/task-service.js')
    await createTask('user-1', { title: 'テスト', bunjinId: 'bunjin-1' })

    expect(bunjinFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'bunjin-1' },
    })
    expect(taskCreateMock).toHaveBeenCalled()
  })

  it('存在しないbunjinIdの場合はValidationErrorをスローする', async () => {
    bunjinFindUniqueMock.mockResolvedValue(null)

    const { createTask } = await import('@/lib/services/task-service.js')

    await expect(
      createTask('user-1', { title: 'テスト', bunjinId: 'nonexistent' })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'Bunjin not found: nonexistent',
    })
  })
})

describe('updateTaskStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('TODO → DOING の有効な遷移を実行する', async () => {
    taskFindUniqueMock.mockResolvedValue({
      id: 't1',
      userId: 'user-1',
      status: 'TODO',
    })
    taskUpdateMock.mockResolvedValue({
      id: 't1',
      status: 'DOING',
    })

    const { updateTaskStatus } = await import('@/lib/services/task-service.js')
    const result = await updateTaskStatus('user-1', 't1', 'DOING')

    expect(result.status).toBe('DOING')
    expect(taskUpdateMock).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { status: 'DOING' },
      include: { bunjin: bunjinSelect },
    })
  })

  it('DOING → ARCHIVED の遷移でarchivedAtが設定される', async () => {
    taskFindUniqueMock.mockResolvedValue({
      id: 't1',
      userId: 'user-1',
      status: 'DOING',
    })
    taskUpdateMock.mockResolvedValue({
      id: 't1',
      status: 'ARCHIVED',
      archivedAt: new Date(),
    })

    const { updateTaskStatus } = await import('@/lib/services/task-service.js')
    await updateTaskStatus('user-1', 't1', 'ARCHIVED')

    expect(taskUpdateMock).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: expect.objectContaining({
        status: 'ARCHIVED',
        archivedAt: expect.any(Date),
      }),
      include: { bunjin: bunjinSelect },
    })
  })

  it('ARCHIVED → TODO の無効な遷移はValidationErrorをスローする', async () => {
    taskFindUniqueMock.mockResolvedValue({
      id: 't1',
      userId: 'user-1',
      status: 'ARCHIVED',
    })

    const { updateTaskStatus } = await import('@/lib/services/task-service.js')

    await expect(
      updateTaskStatus('user-1', 't1', 'TODO')
    ).rejects.toMatchObject({
      name: 'ValidationError',
    })
  })

  it('存在しないタスクはNotFoundErrorをスローする', async () => {
    taskFindUniqueMock.mockResolvedValue(null)

    const { updateTaskStatus } = await import('@/lib/services/task-service.js')

    await expect(
      updateTaskStatus('user-1', 'nonexistent', 'DOING')
    ).rejects.toMatchObject({
      name: 'NotFoundError',
      message: 'Task not found: nonexistent',
    })
  })
})

describe('archiveStaleTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('古いタスクをアーカイブして件数とIDリストを返す', async () => {
    taskFindManyMock.mockResolvedValue([
      { id: 't1' },
      { id: 't2' },
    ])
    taskUpdateManyMock.mockResolvedValue({ count: 2 })

    const { archiveStaleTasks } = await import('@/lib/services/task-service.js')
    const result = await archiveStaleTasks()

    expect(result.count).toBe(2)
    expect(result.archivedIds).toEqual(['t1', 't2'])
    expect(taskUpdateManyMock).toHaveBeenCalledWith({
      where: { id: { in: ['t1', 't2'] } },
      data: {
        status: 'ARCHIVED',
        archivedAt: expect.any(Date),
      },
    })
  })

  it('対象タスクがない場合はcount 0を返す', async () => {
    taskFindManyMock.mockResolvedValue([])

    const { archiveStaleTasks } = await import('@/lib/services/task-service.js')
    const result = await archiveStaleTasks()

    expect(result).toEqual({ count: 0, archivedIds: [] })
    expect(taskUpdateManyMock).not.toHaveBeenCalled()
  })
})
