import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

function createPrismaClient() {
  if (!process.env.DATABASE_URL) return null
  return new PrismaClient()
}

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production' && prisma) {
  globalForPrisma.prisma = prisma
}
