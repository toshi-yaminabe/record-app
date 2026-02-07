/**
 * タスク自動アーカイブCronジョブ
 * GET /api/cron/archive-tasks - 14日以上更新のないタスクをアーカイブ
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.js'
import { errorResponse } from '@/lib/errors.js'
import { archiveStaleTasks } from '@/lib/services/task-service.js'

/**
 * 古いタスクを自動アーカイブ
 * - TODO/DOINGステータスで14日以上更新がないタスクをARCHIVED化
 * - Vercel CronやGitHub Actionsから定期実行される想定
 * - CRON_SECRET ヘッダーで認証
 */
export async function GET(request) {
  try {
    // CRON_SECRET認証（必須 - 未設定時はアクセス拒否）
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      console.error('CRON_SECRET is not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      )
    }

    const result = await archiveStaleTasks()

    return NextResponse.json({
      success: true,
      archivedCount: result.count,
      archivedIds: result.archivedIds,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
