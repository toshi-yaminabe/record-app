/**
 * /api/health - ヘルスチェック（認証不要）
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.js'
import { isGeminiAvailableAsync } from '@/lib/gemini.js'

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
        console.error('Database health check failed:', error)
      }
    }

    geminiOk = await isGeminiAvailableAsync()

    const ok = databaseOk && geminiOk

    return NextResponse.json({
      success: true,
      data: { ok, database: databaseOk, gemini: geminiOk, version },
    })
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      { success: false, error: 'Health check failed' },
      { status: 500 }
    )
  }
}
