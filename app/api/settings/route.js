/**
 * /api/settings - ユーザー設定管理
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.js'
import { MOCK_USER_ID } from '@/lib/constants.js'
import { encrypt, decrypt } from '@/lib/crypto.js'
import { errorResponse } from '@/lib/errors.js'

/**
 * GET /api/settings - ユーザー設定取得
 * APIキーは存在有無のみ返す（値は返さない）
 */
export async function GET() {
  try {
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      )
    }

    const settings = await prisma.userSettings.findUnique({
      where: { userId: MOCK_USER_ID },
    })

    return NextResponse.json({
      settings: {
        hasGeminiApiKey: !!settings?.geminiApiKey,
        updatedAt: settings?.updatedAt ?? null,
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * PUT /api/settings - ユーザー設定更新
 * Body: { geminiApiKey?: string }
 */
export async function PUT(request) {
  try {
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { geminiApiKey } = body

    // APIキーの基本バリデーション
    if (geminiApiKey !== undefined && geminiApiKey !== null) {
      if (typeof geminiApiKey !== 'string') {
        return NextResponse.json(
          { error: 'geminiApiKey must be a string' },
          { status: 400 }
        )
      }
      if (geminiApiKey.length > 0 && geminiApiKey.length < 10) {
        return NextResponse.json(
          { error: 'Invalid API key format' },
          { status: 400 }
        )
      }
    }

    // 暗号化して保存
    const encryptedKey = geminiApiKey ? encrypt(geminiApiKey) : null

    const settings = await prisma.userSettings.upsert({
      where: { userId: MOCK_USER_ID },
      update: {
        geminiApiKey: encryptedKey,
      },
      create: {
        userId: MOCK_USER_ID,
        geminiApiKey: encryptedKey,
      },
    })

    return NextResponse.json({
      settings: {
        hasGeminiApiKey: !!settings.geminiApiKey,
        updatedAt: settings.updatedAt,
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * DELETE /api/settings - APIキーを削除
 */
export async function DELETE() {
  try {
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      )
    }

    await prisma.userSettings.upsert({
      where: { userId: MOCK_USER_ID },
      update: { geminiApiKey: null },
      create: { userId: MOCK_USER_ID },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}
