import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

// Only initialize Prisma if DATABASE_URL is available
export const prisma = globalForPrisma.prisma || (process.env.DATABASE_URL ? new PrismaClient({
  errorFormat: 'minimal',
}) : null)

// Cache Prisma Client in development to avoid hot-reload issues
if (process.env.NODE_ENV !== 'production' && prisma) {
  globalForPrisma.prisma = prisma
}
