/**
 * サービス層 統合テスト
 *
 * 実際のPrismaクライアント + Supabase DBに対してCRUDライフサイクルを検証。
 * DATABASE_URL未設定時は全スキップ。
 * テストユーザーIDで全操作し、afterAllで全データをクリーンアップ。
 */

import { describe, it, expect, afterAll, beforeAll } from 'vitest'

const TEST_USER_ID = 'test-integration-user-001'
const TEST_DEVICE_ID = 'test-device-integration'

// 明示的にRUN_INTEGRATION_TESTS=trueが設定された場合のみ実行
const canRun = process.env.RUN_INTEGRATION_TESTS === 'true' && !!process.env.DATABASE_URL

describe.skipIf(!canRun)('Service Integration Tests (real DB)', () => {
  let prisma

  beforeAll(async () => {
    const mod = await import('@/lib/prisma.js')
    prisma = mod.prisma
    if (!prisma) throw new Error('Prisma client not available')

    // テストユーザーの既存データをクリーンアップ
    await cleanup(prisma)
  })

  afterAll(async () => {
    if (prisma) {
      await cleanup(prisma)
      await prisma.$disconnect()
    }
  })

  // ============================================
  // Session CRUD ライフサイクル
  // ============================================
  describe('Session lifecycle', () => {
    let sessionId

    it('creates a session', async () => {
      const { createSession } = await import('@/lib/services/session-service.js')
      const session = await createSession(TEST_USER_ID, { deviceId: TEST_DEVICE_ID })

      expect(session).toBeDefined()
      expect(session.id).toBeDefined()
      expect(session.userId).toBe(TEST_USER_ID)
      expect(session.deviceId).toBe(TEST_DEVICE_ID)
      expect(session.status).toBe('ACTIVE')
      sessionId = session.id
    })

    it('lists sessions for user', async () => {
      const { listSessions } = await import('@/lib/services/session-service.js')
      const sessions = await listSessions(TEST_USER_ID)

      expect(sessions.length).toBeGreaterThanOrEqual(1)
      const found = sessions.find(s => s.id === sessionId)
      expect(found).toBeDefined()
      expect(found.status).toBe('ACTIVE')
    })

    it('gets session detail', async () => {
      const { getSession } = await import('@/lib/services/session-service.js')
      const session = await getSession(TEST_USER_ID, sessionId)

      expect(session.id).toBe(sessionId)
      expect(session.segments).toBeDefined()
      expect(Array.isArray(session.segments)).toBe(true)
    })

    it('does NOT list other user\'s sessions', async () => {
      const { listSessions } = await import('@/lib/services/session-service.js')
      const sessions = await listSessions('other-user-xyz')

      const found = sessions.find(s => s.id === sessionId)
      expect(found).toBeUndefined()
    })

    it('stops a session', async () => {
      const { stopSession } = await import('@/lib/services/session-service.js')
      const stopped = await stopSession(TEST_USER_ID, sessionId)

      expect(stopped.status).toBe('STOPPED')
      expect(stopped.endedAt).toBeDefined()
    })
  })

  // ============================================
  // Bunjin CRUD ライフサイクル
  // ============================================
  describe('Bunjin lifecycle', () => {
    let bunjinId

    it('creates a custom bunjin', async () => {
      const { createBunjin } = await import('@/lib/services/bunjin-service.js')
      const bunjin = await createBunjin(TEST_USER_ID, {
        slug: 'test-bunjin',
        displayName: 'テスト分人',
        color: '#ff0000',
        icon: 'star',
      })

      expect(bunjin).toBeDefined()
      expect(bunjin.id).toBeDefined()
      expect(bunjin.slug).toBe('test-bunjin')
      expect(bunjin.displayName).toBe('テスト分人')
      expect(bunjin.isDefault).toBe(false)
      bunjinId = bunjin.id
    })

    it('lists bunjins for user', async () => {
      const { listBunjins } = await import('@/lib/services/bunjin-service.js')
      const bunjins = await listBunjins(TEST_USER_ID)

      expect(bunjins.length).toBeGreaterThanOrEqual(1)
      const found = bunjins.find(b => b.id === bunjinId)
      expect(found).toBeDefined()
    })

    it('updates a bunjin', async () => {
      const { updateBunjin } = await import('@/lib/services/bunjin-service.js')
      const updated = await updateBunjin(TEST_USER_ID, bunjinId, {
        displayName: '更新テスト分人',
        color: '#00ff00',
      })

      expect(updated.displayName).toBe('更新テスト分人')
      expect(updated.color).toBe('#00ff00')
    })

    it('rejects duplicate slug', async () => {
      const { createBunjin } = await import('@/lib/services/bunjin-service.js')

      await expect(
        createBunjin(TEST_USER_ID, {
          slug: 'test-bunjin', // same slug
          displayName: '重複テスト',
        }),
      ).rejects.toThrow('already exists')
    })

    it('deletes a bunjin', async () => {
      const { deleteBunjin } = await import('@/lib/services/bunjin-service.js')
      await deleteBunjin(TEST_USER_ID, bunjinId)

      const { listBunjins } = await import('@/lib/services/bunjin-service.js')
      const bunjins = await listBunjins(TEST_USER_ID)
      const found = bunjins.find(b => b.id === bunjinId)
      expect(found).toBeUndefined()
    })
  })

  // ============================================
  // Task CRUD ライフサイクル
  // ============================================
  describe('Task lifecycle', () => {
    let taskId

    it('creates a task', async () => {
      const { createTask } = await import('@/lib/services/task-service.js')
      const task = await createTask(TEST_USER_ID, {
        title: '統合テストタスク',
        body: 'テスト本文',
        priority: 5,
      })

      expect(task).toBeDefined()
      expect(task.id).toBeDefined()
      expect(task.title).toBe('統合テストタスク')
      expect(task.status).toBe('TODO')
      expect(task.priority).toBe(5)
      taskId = task.id
    })

    it('lists tasks for user', async () => {
      const { listTasks } = await import('@/lib/services/task-service.js')
      const tasks = await listTasks(TEST_USER_ID)

      expect(tasks.length).toBeGreaterThanOrEqual(1)
      const found = tasks.find(t => t.id === taskId)
      expect(found).toBeDefined()
    })

    it('updates task status: TODO → DOING', async () => {
      const { updateTaskStatus } = await import('@/lib/services/task-service.js')
      const updated = await updateTaskStatus(TEST_USER_ID, taskId, 'DOING')

      expect(updated.status).toBe('DOING')
    })

    it('updates task status: DOING → DONE', async () => {
      const { updateTaskStatus } = await import('@/lib/services/task-service.js')
      const updated = await updateTaskStatus(TEST_USER_ID, taskId, 'DONE')

      expect(updated.status).toBe('DONE')
    })

    it('rejects invalid transition: DONE → DOING', async () => {
      const { updateTaskStatus } = await import('@/lib/services/task-service.js')

      await expect(
        updateTaskStatus(TEST_USER_ID, taskId, 'DOING'),
      ).rejects.toThrow()
    })

    it('archives task: DONE → ARCHIVED', async () => {
      const { updateTaskStatus } = await import('@/lib/services/task-service.js')
      const updated = await updateTaskStatus(TEST_USER_ID, taskId, 'ARCHIVED')

      expect(updated.status).toBe('ARCHIVED')
      expect(updated.archivedAt).toBeDefined()
    })
  })

  // ============================================
  // Segment CRUD ライフサイクル
  // ============================================
  describe('Segment lifecycle', () => {
    let sessionId
    let segmentId

    beforeAll(async () => {
      // セグメントテスト用にセッションを先に作成
      const { createSession } = await import('@/lib/services/session-service.js')
      const session = await createSession(TEST_USER_ID, { deviceId: TEST_DEVICE_ID })
      sessionId = session.id
    })

    it('creates a PENDING segment', async () => {
      const { createSegment } = await import('@/lib/services/segment-service.js')
      const now = new Date()
      const segment = await createSegment(TEST_USER_ID, {
        sessionId,
        segmentNo: 1,
        startAt: now.toISOString(),
        endAt: new Date(now.getTime() + 600000).toISOString(),
        storageObjectPath: `${TEST_USER_ID}/${sessionId}/1.m4a`,
      })

      expect(segment).toBeDefined()
      expect(segment.id).toBeDefined()
      expect(segment.sttStatus).toBe('PENDING')
      expect(segment.storageObjectPath).toContain('1.m4a')
      segmentId = segment.id
    })

    it('lists segments for user', async () => {
      const { listSegments } = await import('@/lib/services/segment-service.js')
      const segments = await listSegments(TEST_USER_ID, { sessionId })

      expect(segments.length).toBeGreaterThanOrEqual(1)
      const found = segments.find(s => s.id === segmentId)
      expect(found).toBeDefined()
    })

    it('gets segment detail', async () => {
      const { getSegment } = await import('@/lib/services/segment-service.js')
      const segment = await getSegment(TEST_USER_ID, segmentId)

      expect(segment.id).toBe(segmentId)
      expect(segment.session).toBeDefined()
      expect(segment.session.id).toBe(sessionId)
    })

    it('updates segment STT status: PENDING → DONE', async () => {
      const { updateSegmentSttStatus } = await import('@/lib/services/segment-service.js')
      const updated = await updateSegmentSttStatus(TEST_USER_ID, segmentId, {
        sttStatus: 'DONE',
        text: 'テスト文字起こし結果',
      })

      expect(updated.sttStatus).toBe('DONE')
      expect(updated.text).toBe('テスト文字起こし結果')
    })

    it('upserts segment (idempotent)', async () => {
      const { createSegment } = await import('@/lib/services/segment-service.js')
      const now = new Date()
      const segment = await createSegment(TEST_USER_ID, {
        sessionId,
        segmentNo: 1, // same segmentNo → upsert
        startAt: now.toISOString(),
        endAt: new Date(now.getTime() + 600000).toISOString(),
      })

      // Should update existing, not create new
      expect(segment.id).toBe(segmentId)
    })
  })

  // ============================================
  // Cross-user isolation (DB level)
  // ============================================
  describe('Cross-user isolation', () => {
    let sessionId

    beforeAll(async () => {
      const { createSession } = await import('@/lib/services/session-service.js')
      const session = await createSession(TEST_USER_ID, { deviceId: TEST_DEVICE_ID })
      sessionId = session.id
    })

    it('other user cannot get this user\'s session', async () => {
      const { getSession } = await import('@/lib/services/session-service.js')

      await expect(
        getSession('attacker-user-id', sessionId),
      ).rejects.toThrow('not found')
    })

    it('other user cannot stop this user\'s session', async () => {
      const { stopSession } = await import('@/lib/services/session-service.js')

      await expect(
        stopSession('attacker-user-id', sessionId),
      ).rejects.toThrow('not found')
    })

    it('other user cannot create segment in this user\'s session', async () => {
      const { createSegment } = await import('@/lib/services/segment-service.js')
      const now = new Date()

      await expect(
        createSegment('attacker-user-id', {
          sessionId,
          segmentNo: 99,
          startAt: now.toISOString(),
          endAt: new Date(now.getTime() + 60000).toISOString(),
        }),
      ).rejects.toThrow('not found')
    })
  })
})

/**
 * テストユーザーのデータを全クリーンアップ
 * FK制約の順序を考慮して削除
 */
async function cleanup(prisma) {
  // 順序: segments → sessions → tasks → bunjins → memories → proposals 等
  await prisma.segment.deleteMany({ where: { userId: TEST_USER_ID } })
  await prisma.session.deleteMany({ where: { userId: TEST_USER_ID } })
  await prisma.task.deleteMany({ where: { userId: TEST_USER_ID } })
  await prisma.bunjin.deleteMany({ where: { userId: TEST_USER_ID } })
  await prisma.memory.deleteMany({ where: { userId: TEST_USER_ID } })
  await prisma.proposal.deleteMany({ where: { userId: TEST_USER_ID } })
  await prisma.swlsResponse.deleteMany({ where: { userId: TEST_USER_ID } })
}
