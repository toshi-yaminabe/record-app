#!/usr/bin/env node

/**
 * create-owner-account.mjs
 *
 * Supabase Admin APIでメール確認済みオーナーアカウントを作成
 * Usage: node scripts/create-owner-account.mjs
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function main() {
  console.log('Creating owner account...')

  const { data, error } = await supabase.auth.admin.createUser({
    email: 'kitaitoshiki@gmail.com',
    password: 'kkkkitai',
    email_confirm: true,
  })

  if (error) {
    console.error('Failed to create user:', error.message)
    process.exit(1)
  }

  console.log('Owner account created successfully!')
  console.log('User ID:', data.user.id)
  console.log('Email:', data.user.email)
  console.log('Email confirmed:', data.user.email_confirmed_at ? 'Yes' : 'No')
  console.log('')
  console.log('Next step: Run user ID migration')
  console.log(`  node scripts/migrate-user-ids.mjs "${data.user.id}"`)
}

main()
