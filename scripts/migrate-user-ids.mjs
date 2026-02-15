#!/usr/bin/env node

/**
 * migrate-user-ids.mjs
 *
 * mock-user-001 → Supabase Auth UUID に一括変換
 *
 * Usage:
 *   node scripts/migrate-user-ids.mjs <new-user-id>
 *
 * Example:
 *   node scripts/migrate-user-ids.mjs "550e8400-e29b-41d4-a716-446655440000"
 *
 * 対象テーブル（userId カラムを持つ10テーブル）:
 *   bunjins, rule_trees, sessions, segments, proposals,
 *   tasks, weekly_executions, swls_responses, memories, user_settings
 */

import { PrismaClient } from '@prisma/client'

const OLD_USER_ID = 'mock-user-001'

const TABLES_WITH_USER_ID = [
  'bunjins',
  'rule_trees',
  'sessions',
  'segments',
  'proposals',
  'tasks',
  'weekly_executions',
  'swls_responses',
  'memories',
  'user_settings',
]

async function main() {
  const newUserId = process.argv[2]

  if (!newUserId) {
    console.error('Usage: node scripts/migrate-user-ids.mjs <new-user-id>')
    console.error('Example: node scripts/migrate-user-ids.mjs "550e8400-e29b-41d4-a716-446655440000"')
    process.exit(1)
  }

  if (newUserId === OLD_USER_ID) {
    console.error('Error: New user ID must be different from old user ID')
    process.exit(1)
  }

  const prisma = new PrismaClient()

  try {
    console.log(`Migrating user_id: "${OLD_USER_ID}" → "${newUserId}"`)
    console.log('---')

    // dry-run: カウント表示
    for (const table of TABLES_WITH_USER_ID) {
      const result = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM ${table} WHERE user_id = $1`,
        OLD_USER_ID
      )
      const count = Number(result[0].count)
      console.log(`  ${table}: ${count} rows`)
    }

    console.log('---')
    console.log('Executing migration in a transaction...')

    await prisma.$transaction(async (tx) => {
      for (const table of TABLES_WITH_USER_ID) {
        const result = await tx.$executeRawUnsafe(
          `UPDATE ${table} SET user_id = $1 WHERE user_id = $2`,
          newUserId,
          OLD_USER_ID
        )
        console.log(`  ✓ ${table}: ${result} rows updated`)
      }
    })

    console.log('---')
    console.log('Migration completed successfully!')

    // 検証
    console.log('\nVerification:')
    for (const table of TABLES_WITH_USER_ID) {
      const oldResult = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM ${table} WHERE user_id = $1`,
        OLD_USER_ID
      )
      const newResult = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM ${table} WHERE user_id = $1`,
        newUserId
      )
      const oldCount = Number(oldResult[0].count)
      const newCount = Number(newResult[0].count)
      const status = oldCount === 0 ? '✓' : '✗'
      console.log(`  ${status} ${table}: old=${oldCount}, new=${newCount}`)
    }
  } catch (error) {
    console.error('Migration failed:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
