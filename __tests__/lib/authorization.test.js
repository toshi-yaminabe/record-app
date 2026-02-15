import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ValidationError, NotFoundError } from '@/lib/errors.js'

// Mock prisma
const mockPrisma = {
  session: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  segment: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  bunjin: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  task: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  publishedVersion: {
    findFirst: vi.fn(),
  },
}

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

describe('Authorization - userId isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================
  // Session Service
  // ============================================
  describe('session-service', () => {
    it('createSession requires userId', async () => {
      const { createSession } = await import('@/lib/services/session-service.js')

      await expect(createSession(null, { deviceId: 'dev1' }))
        .rejects.toThrow(ValidationError)

      await expect(createSession('', { deviceId: 'dev1' }))
        .rejects.toThrow(ValidationError)
    })

    it('listSessions filters by userId', async () => {
      const { listSessions } = await import('@/lib/services/session-service.js')
      mockPrisma.session.findMany.mockResolvedValue([])

      await listSessions('user-A', { limit: 10 })

      expect(mockPrisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-A' },
        }),
      )
    })

    it('getSession returns NotFoundError for other user\'s session', async () => {
      const { getSession } = await import('@/lib/services/session-service.js')
      // Session exists but belongs to different user
      mockPrisma.session.findFirst.mockResolvedValue(null)

      await expect(getSession('user-A', 'session-of-user-B'))
        .rejects.toThrow(NotFoundError)
    })

    it('stopSession returns NotFoundError for other user\'s session', async () => {
      const { stopSession } = await import('@/lib/services/session-service.js')
      mockPrisma.session.findFirst.mockResolvedValue(null)

      await expect(stopSession('user-A', 'session-of-user-B'))
        .rejects.toThrow(NotFoundError)
    })
  })

  // ============================================
  // Task Service
  // ============================================
  describe('task-service', () => {
    it('createTask requires userId', async () => {
      const { createTask } = await import('@/lib/services/task-service.js')

      await expect(createTask(null, { title: 'test', bunjinId: 'b1' }))
        .rejects.toThrow(ValidationError)
    })

    it('listTasks filters by userId', async () => {
      const { listTasks } = await import('@/lib/services/task-service.js')
      mockPrisma.task.findMany.mockResolvedValue([])

      await listTasks('user-A')

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-A' }),
        }),
      )
    })

    it('updateTaskStatus returns NotFoundError for other user\'s task', async () => {
      const { updateTaskStatus } = await import('@/lib/services/task-service.js')
      // findUnique returns a task belonging to different user (or null for userId mismatch)
      mockPrisma.task.findUnique.mockResolvedValue({ id: 'task-of-user-B', userId: 'user-B', status: 'TODO' })

      await expect(updateTaskStatus('user-A', 'task-of-user-B', 'DOING'))
        .rejects.toThrow(NotFoundError)
    })
  })

  // ============================================
  // Bunjin Service
  // ============================================
  describe('bunjin-service', () => {
    it('listBunjins filters by userId', async () => {
      const { listBunjins } = await import('@/lib/services/bunjin-service.js')
      mockPrisma.bunjin.findMany.mockResolvedValue([])

      await listBunjins('user-A')

      expect(mockPrisma.bunjin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-A' },
        }),
      )
    })

    it('createBunjin requires userId', async () => {
      const { createBunjin } = await import('@/lib/services/bunjin-service.js')

      await expect(createBunjin(null, { slug: 'test', displayName: 'Test' }))
        .rejects.toThrow(ValidationError)
    })
  })

  // ============================================
  // Segment Service
  // ============================================
  describe('segment-service', () => {
    it('listSegments filters by userId', async () => {
      const { listSegments } = await import('@/lib/services/segment-service.js')
      mockPrisma.segment.findMany.mockResolvedValue([])

      await listSegments('user-A', { sessionId: 's1' })

      expect(mockPrisma.segment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-A' }),
        }),
      )
    })

    it('createSegment requires userId', async () => {
      const { createSegment } = await import('@/lib/services/segment-service.js')

      await expect(
        createSegment(null, {
          sessionId: 's1',
          segmentNo: 1,
          startAt: new Date().toISOString(),
          endAt: new Date().toISOString(),
        }),
      ).rejects.toThrow(ValidationError)
    })
  })
})
