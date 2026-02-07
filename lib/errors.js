/**
 * エラーハンドリングユーティリティ
 */

import { NextResponse } from 'next/server'

// ========================================
// カスタムエラークラス
// ========================================

export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource, id) {
    super(`${resource} not found: ${id}`, 404)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409)
    this.name = 'ConflictError'
  }
}

// ========================================
// 統一エラーレスポンス
// ========================================

/**
 * エラーをNextResponseに変換
 * @param {Error} error
 * @returns {NextResponse}
 */
export function errorResponse(error) {
  // 既知のAppError
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    )
  }

  // Prismaのユニーク制約違反
  if (error?.code === 'P2002') {
    return NextResponse.json(
      { error: 'Resource already exists' },
      { status: 409 }
    )
  }

  // Prismaのレコード未検出
  if (error?.code === 'P2025') {
    return NextResponse.json(
      { error: 'Record not found' },
      { status: 404 }
    )
  }

  // 未知のエラー
  console.error('Unhandled error:', error)
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  )
}
