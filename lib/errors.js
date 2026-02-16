/**
 * エラーハンドリングユーティリティ
 */

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

