/**
 * Supabase Admin Client（サーバーサイド専用）
 * - service_role keyでRLSバイパス
 * - Edge Function呼び出し、Storage操作等に使用
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Supabase Admin Clientを取得
 * 本番環境では必須、開発環境では未設定時にnull返却
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
export function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production')
    }
    return null
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
