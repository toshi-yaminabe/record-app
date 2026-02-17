import { describe, it, expect, vi, beforeEach } from 'vitest'

const segmentGroupByMock = vi.fn()
const segmentAggregateMock = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    segment: {
      groupBy: segmentGroupByMock,
      aggregate: segmentAggregateMock,
    },
  },
}))

describe('getDailyKpi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('指定日の mode 別セグメント数を返す', async () => {
    segmentGroupByMock.mockResolvedValue([
      { selectedMode: 'SERVER', _count: { id: 10 } },
      { selectedMode: 'LOCAL', _count: { id: 5 } },
    ])

    const { getDailyKpi } = await import('@/lib/services/kpi-service.js')
    const result = await getDailyKpi('user-1', '2026-02-17')

    expect(result.dateKey).toBe('2026-02-17')
    expect(result.server).toBe(10)
    expect(result.local).toBe(5)
    expect(result.total).toBe(15)
    expect(result.localRatio).toBeCloseTo(5 / 15)
  })

  it('セグメントがない場合はゼロを返す', async () => {
    segmentGroupByMock.mockResolvedValue([])

    const { getDailyKpi } = await import('@/lib/services/kpi-service.js')
    const result = await getDailyKpi('user-1', '2026-02-17')

    expect(result.server).toBe(0)
    expect(result.local).toBe(0)
    expect(result.total).toBe(0)
    expect(result.localRatio).toBe(0)
  })

  it('userIdが空の場合はValidationErrorをスローする', async () => {
    const { getDailyKpi } = await import('@/lib/services/kpi-service.js')
    await expect(getDailyKpi('', '2026-02-17')).rejects.toMatchObject({
      name: 'ValidationError',
    })
  })

  it('不正な日付キーの場合はValidationErrorをスローする', async () => {
    const { getDailyKpi } = await import('@/lib/services/kpi-service.js')
    await expect(getDailyKpi('user-1', 'invalid')).rejects.toMatchObject({
      name: 'ValidationError',
    })
  })
})

describe('getWeeklyKpi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('指定週の mode 別セグメント数を返す', async () => {
    segmentGroupByMock.mockResolvedValue([
      { selectedMode: 'SERVER', _count: { id: 50 } },
      { selectedMode: 'LOCAL', _count: { id: 30 } },
    ])

    const { getWeeklyKpi } = await import('@/lib/services/kpi-service.js')
    const result = await getWeeklyKpi('user-1', '2026-W08')

    expect(result.weekKey).toBe('2026-W08')
    expect(result.server).toBe(50)
    expect(result.local).toBe(30)
    expect(result.total).toBe(80)
    expect(result.localRatio).toBeCloseTo(30 / 80)
  })

  it('userIdが空の場合はValidationErrorをスローする', async () => {
    const { getWeeklyKpi } = await import('@/lib/services/kpi-service.js')
    await expect(getWeeklyKpi('', '2026-W08')).rejects.toMatchObject({
      name: 'ValidationError',
    })
  })

  it('不正な週キーの場合はValidationErrorをスローする', async () => {
    const { getWeeklyKpi } = await import('@/lib/services/kpi-service.js')
    await expect(getWeeklyKpi('user-1', 'invalid')).rejects.toMatchObject({
      name: 'ValidationError',
    })
  })
})
