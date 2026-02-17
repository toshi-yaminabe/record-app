/**
 * Supabase Admin Client（サーバーサイド専用）
 * - service_role keyでRLSバイパス
 * - Edge Function呼び出し、Storage操作等に使用
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

let adminClient = null
let authClient = null


/**
 * Authクライアント設定の状態を返す
 * @returns {{ ok: boolean, reason?: string }}
 */
export function getSupabaseAuthConfigStatus() {
  if (!supabaseUrl) {
    return { ok: false, reason: 'SUPABASE_URL is not configured' }
  }

  if (!supabaseServiceRoleKey && !supabaseAnonKey) {
    return { ok: false, reason: 'SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required' }
  }

  return { ok: true }
}

/**
 * Supabase Admin Clientを取得
 * 本番環境では必須、開発環境では未設定時にnull返却
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
export function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null
  }

  if (adminClient) {
    return adminClient
  }

  adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return adminClient
}

/**
 * Supabase Auth検証用クライアントを取得
 * - service_role優先、未設定時はanon keyでフォールバック
 * - どちらも未設定ならnull
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
export function getSupabaseAuthClient() {
  if (!supabaseUrl) {
    return null
  }

  const authKey = supabaseServiceRoleKey || supabaseAnonKey
  if (!authKey) {
    return null
  }

  if (authClient) {
    return authClient
  }

  authClient = createClient(supabaseUrl, authKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return authClient
}
