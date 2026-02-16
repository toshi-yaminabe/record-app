import { describe, it, expect, vi, beforeEach } from 'vitest'

const findManyMock = vi.fn()

vi.mock('@/lib/prisma.js', () => ({
  prisma: {
    segment: {
      findMany: findManyMock,
    },
    proposal: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/gemini.js', () => ({
  generateProposals: vi.fn(),
}))

describe('generateDailyProposals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('文字起こし済みセグメントがない場合、日本語の案内メッセージを返す', async () => {
    findManyMock.mockResolvedValue([])

    const { generateDailyProposals } = await import('@/lib/services/proposal-service.js')

    await expect(
      generateDailyProposals('user-1', '2026-02-16')
    ).rejects.toMatchObject({
      message: expect.stringContaining('文字起こし済みの録音がありません'),
    })
  })
})
