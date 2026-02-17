import { describe, it, expect } from 'vitest'
import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '@/lib/errors.js'

describe('AppError', () => {
  it('message と statusCode を保持する', () => {
    const error = new AppError('something went wrong', 503)
    expect(error.message).toBe('something went wrong')
    expect(error.statusCode).toBe(503)
  })

  it('statusCode のデフォルトは 500', () => {
    const error = new AppError('internal error')
    expect(error.statusCode).toBe(500)
  })

  it('name は "AppError"', () => {
    const error = new AppError('test')
    expect(error.name).toBe('AppError')
  })

  it('Error を継承している', () => {
    const error = new AppError('test')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(AppError)
  })
})

describe('ValidationError', () => {
  it('statusCode は 400', () => {
    const error = new ValidationError('invalid input')
    expect(error.statusCode).toBe(400)
  })

  it('name は "ValidationError"', () => {
    const error = new ValidationError('bad data')
    expect(error.name).toBe('ValidationError')
  })

  it('AppError を継承している', () => {
    const error = new ValidationError('test')
    expect(error).toBeInstanceOf(AppError)
    expect(error).toBeInstanceOf(Error)
  })

  it('message を保持する', () => {
    const error = new ValidationError('email is required')
    expect(error.message).toBe('email is required')
  })
})

describe('NotFoundError', () => {
  it('statusCode は 404', () => {
    const error = new NotFoundError('Bunjin', 'bunjin-123')
    expect(error.statusCode).toBe(404)
  })

  it('message に resource と id が含まれる', () => {
    const error = new NotFoundError('Task', 'task-abc')
    expect(error.message).toBe('Task not found: task-abc')
  })

  it('name は "NotFoundError"', () => {
    const error = new NotFoundError('Session', 'sess-1')
    expect(error.name).toBe('NotFoundError')
  })

  it('AppError を継承している', () => {
    const error = new NotFoundError('User', 'u-1')
    expect(error).toBeInstanceOf(AppError)
    expect(error).toBeInstanceOf(Error)
  })
})

describe('ConflictError', () => {
  it('statusCode は 409', () => {
    const error = new ConflictError('slug already exists')
    expect(error.statusCode).toBe(409)
  })

  it('name は "ConflictError"', () => {
    const error = new ConflictError('duplicate')
    expect(error.name).toBe('ConflictError')
  })

  it('message を保持する', () => {
    const error = new ConflictError('Bunjin slug "work" already exists')
    expect(error.message).toBe('Bunjin slug "work" already exists')
  })

  it('AppError を継承している', () => {
    const error = new ConflictError('conflict')
    expect(error).toBeInstanceOf(AppError)
    expect(error).toBeInstanceOf(Error)
  })
})
