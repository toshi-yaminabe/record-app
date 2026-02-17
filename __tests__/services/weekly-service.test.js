import { describe, it, expect, vi, beforeEach } from 'vitest'

const weeklyFindManyMock = vi.fn()
const weeklyCreateMock = vi.fn()
const weeklyFindUniqueMock = vi.fn()
const proposalFindUniqueMock = vi.fn()

vi.mock('@/lib/prisma.js', () => ({
  prisma: {
    weeklyExecution: {
      findMany: weeklyFindManyMock,
      create: weeklyCreateMock,
      findUnique: weeklyFindUniqueMock,
    },
    proposal: {
      findUnique: proposalFindUniqueMock,
    },
  },
}))

const proposalSelect = {
  select: {
    id: true,
    dateKey: true,
    type: true,
    title: true,
    body: true,
    status: true,
  },
}

describe('getWeeklyReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('指定週の実行記録を返す', async () => {
    const mockExecutions = [
      {
        id: 'we1',
        weekKey: '2026-W07',
        proposal: { id: 'p1', title: '提案1', type: 'TASK' },
      },
    ]
    weeklyFindManyMock.mockResolvedValue(mockExecutions)

    const { getWeeklyReview } = await import(
      '@/lib/services/weekly-service.js'
    )
    const result = await getWeeklyReview('user-1', '2026-W07')

    expect(result).toEqual(mockExecutions)
    expect(weeklyFindManyMock).toHaveBeenCalledWith({
      where: { userId: 'user-1', weekKey: '2026-W07' },
      include: { proposal: proposalSelect },
      orderBy: { createdAt: 'asc' },
    })
  })

  it('userIdが未指定の場合はValidationErrorをスローする', async () => {
    const { getWeeklyReview } = await import(
      '@/lib/services/weekly-service.js'
    )

    await expect(getWeeklyReview('', '2026-W07')).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'userId is required',
    })
  })

  it('不正なweekKey形式の場合はValidationErrorをスローする', async () => {
    const { getWeeklyReview } = await import(
      '@/lib/services/weekly-service.js'
    )

    await expect(
      getWeeklyReview('user-1', 'invalid-week')
    ).rejects.toMatchObject({
      name: 'ValidationError',
      message: expect.stringContaining('Invalid weekKey format'),
    })
  })
})

describe('createWeeklyExecution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('有効なデータで週次実行記録を作成する', async () => {
    proposalFindUniqueMock.mockResolvedValue({
      id: 'p1',
      userId: 'user-1',
      title: '提案1',
    })
    weeklyFindUniqueMock.mockResolvedValue(null)
    const created = {
      id: 'we-new',
      userId: 'user-1',
      weekKey: '2026-W07',
      proposalId: 'p1',
      note: '',
      proposal: { id: 'p1', title: '提案1' },
    }
    weeklyCreateMock.mockResolvedValue(created)

    const { createWeeklyExecution } = await import(
      '@/lib/services/weekly-service.js'
    )
    const result = await createWeeklyExecution('user-1', {
      weekKey: '2026-W07',
      proposalId: 'p1',
    })

    expect(result).toEqual(created)
    expect(weeklyCreateMock).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        weekKey: '2026-W07',
        proposalId: 'p1',
        note: '',
      },
      include: { proposal: proposalSelect },
    })
  })

  it('不正なweekKey形式の場合はValidationErrorをスローする', async () => {
    const { createWeeklyExecution } = await import(
      '@/lib/services/weekly-service.js'
    )

    await expect(
      createWeeklyExecution('user-1', {
        weekKey: 'bad-format',
        proposalId: 'p1',
      })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      message: expect.stringContaining('Invalid weekKey format'),
    })
  })

  it('存在しないproposalIdの場合はNotFoundErrorをスローする', async () => {
    proposalFindUniqueMock.mockResolvedValue(null)

    const { createWeeklyExecution } = await import(
      '@/lib/services/weekly-service.js'
    )

    await expect(
      createWeeklyExecution('user-1', {
        weekKey: '2026-W07',
        proposalId: 'nonexistent',
      })
    ).rejects.toMatchObject({
      name: 'NotFoundError',
      message: 'Proposal not found: nonexistent',
    })
  })

  it('他ユーザーのproposalの場合はNotFoundErrorをスローする', async () => {
    proposalFindUniqueMock.mockResolvedValue({
      id: 'p1',
      userId: 'other-user',
    })

    const { createWeeklyExecution } = await import(
      '@/lib/services/weekly-service.js'
    )

    await expect(
      createWeeklyExecution('user-1', {
        weekKey: '2026-W07',
        proposalId: 'p1',
      })
    ).rejects.toMatchObject({
      name: 'NotFoundError',
      message: 'Proposal not found: p1',
    })
  })

  it('同一週+同一提案で重複する場合はValidationErrorをスローする', async () => {
    proposalFindUniqueMock.mockResolvedValue({
      id: 'p1',
      userId: 'user-1',
    })
    weeklyFindUniqueMock.mockResolvedValue({
      id: 'we-existing',
      weekKey: '2026-W07',
      proposalId: 'p1',
    })

    const { createWeeklyExecution } = await import(
      '@/lib/services/weekly-service.js'
    )

    await expect(
      createWeeklyExecution('user-1', {
        weekKey: '2026-W07',
        proposalId: 'p1',
      })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'Weekly execution already exists for this proposal and week',
    })
  })
})
