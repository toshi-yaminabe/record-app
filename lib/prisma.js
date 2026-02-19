import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logger.js'

const globalForPrisma = globalThis
const READ_ACTIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'queryRaw',
  'queryRawUnsafe',
])

const RETRYABLE_PRISMA_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017'])
const MAX_READ_RETRIES = 2

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryablePrismaError(error) {
  if (!error) return false

  const message = String(error.message || '').toLowerCase()

  // Check constructor name instead of instanceof to avoid importing Prisma at top level
  const errorName = error.constructor?.name || ''
  if (
    errorName === 'PrismaClientInitializationError'
    || errorName === 'PrismaClientRustPanicError'
    || errorName === 'PrismaClientUnknownRequestError'
  ) {
    return true
  }

  if (errorName === 'PrismaClientKnownRequestError' && RETRYABLE_PRISMA_CODES.has(error.code)) {
    return true
  }

  return (
    message.includes('can\'t reach database server')
    || message.includes('connection')
    || message.includes('timed out')
    || message.includes('econnreset')
    || message.includes('socket hang up')
  )
}

function createPrismaClient() {
  if (!process.env.DATABASE_URL) return null

  const base = new PrismaClient()

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const isReadAction = READ_ACTIONS.has(operation)
          if (!isReadAction) {
            return query(args)
          }

          let attempt = 0
          for (;;) {
            try {
              return await query(args)
            } catch (error) {
              if (!isRetryablePrismaError(error) || attempt >= MAX_READ_RETRIES) {
                throw error
              }

              attempt += 1
              const backoffMs = 150 * attempt
              logger.warn('Retrying transient Prisma read error', {
                component: 'prisma',
                action: operation,
                model,
                attempt,
                backoffMs,
                error: error.message,
                code: error.code,
              })
              await sleep(backoffMs)
            }
          }
        },
      },
    },
  })
}

// serverExternalPackages で @prisma/client はwebpackバンドル対象外のため
// 通常の静的インポートで安全に利用可能
export const prisma = globalForPrisma.__prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production' && prisma) {
  globalForPrisma.__prisma = prisma
}
