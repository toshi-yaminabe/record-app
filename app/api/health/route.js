/**
 * /api/health - ヘルスチェック（認証不要）
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.js'
import { isGeminiAvailableAsync } from '@/lib/gemini.js'
import { logger } from '@/lib/logger.js'

const version = process.env.APP_VERSION || 'unknown'

export async function GET() {
  try {
    let databaseOk = false
    let geminiOk = false

    if (prisma) {
      try {
        await prisma.$queryRaw`SELECT 1`
        databaseOk = true
      } catch (error) {
        logger.error('Database health check failed', { component: 'health', error: error.message })
      }
    }

    geminiOk = await isGeminiAvailableAsync()

    const ok = databaseOk && geminiOk

    // 本番環境では内部状態を非公開にし、ok フラグのみ返す
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ success: true, data: { ok } })
    }

    return NextResponse.json({
      success: true,
      data: { ok, database: databaseOk, gemini: geminiOk, version },
    })
  } catch (error) {
    logger.error('Health check error', { component: 'health', error: error.message })
    return NextResponse.json(
      { success: false, error: 'Health check failed' },
      { status: 500 }
    )
  }
}
