'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/app/lib/supabase-client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAccessToken(session?.access_token ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setAccessToken(session?.access_token ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (email, password) => {
    if (!supabase) {
      setError('Supabase が設定されていません')
      return { error: 'Supabase not configured' }
    }
    setError(null)
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (authError) {
      const msg = translateAuthError(authError.message)
      setError(msg)
      return { error: msg }
    }
    return { data }
  }, [])

  const signUp = useCallback(async (email, password) => {
    if (!supabase) {
      setError('Supabase が設定されていません')
      return { error: 'Supabase not configured' }
    }
    setError(null)
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })
    if (authError) {
      const msg = translateAuthError(authError.message)
      setError(msg)
      return { error: msg }
    }
    if (data.user && !data.session) {
      const msg = '確認メールを送信しました。メールを確認してください。'
      setError(msg)
      return { needsConfirmation: true, message: msg }
    }
    return { data }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    setError(null)
    const { error: authError } = await supabase.auth.signOut()
    if (authError) {
      setError('ログアウトに失敗しました')
    }
  }, [])

  const value = {
    user,
    accessToken,
    loading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    error,
    clearError: () => setError(null),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

function translateAuthError(message) {
  const msg = message.toLowerCase()
  if (msg.includes('invalid login credentials')) {
    return 'メールアドレスまたはパスワードが正しくありません'
  }
  if (msg.includes('email not confirmed')) {
    return 'メールアドレスが確認されていません。確認メールをチェックしてください。'
  }
  if (msg.includes('user already registered')) {
    return 'このメールアドレスは既に登録されています'
  }
  if (msg.includes('password')) {
    return 'パスワードは6文字以上にしてください'
  }
  return message
}
