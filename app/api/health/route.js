/**
 * /api/health - ヘルスチェック
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.js'
import { isGeminiAvailableAsync } from '@/lib/gemini.js'

/**
 * GET /api/health - システム状態確認
 * Returns: { ok: boolean, database: boolean, gemini: boolean }
 */
export async function GET() {
  try {
    let databaseOk = false
    let geminiOk = false

    // データベース接続確認
    if (prisma) {
      try {
        await prisma.$queryRaw`SELECT 1`
        databaseOk = true
      } catch (error) {
        console.error('Database health check failed:', error)
      }
    }

    // Gemini API確認（環境変数 + DB保存キー）
    geminiOk = await isGeminiAvailableAsync()

    const ok = databaseOk && geminiOk

    return NextResponse.json({
      ok,
      database: databaseOk,
      gemini: geminiOk,
    })
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      {
        ok: false,
        database: false,
        gemini: false,
        error: 'Health check failed',
      },
      { status: 500 }
    )
  }
}
