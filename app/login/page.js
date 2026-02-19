'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/auth-context'

export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated, loading, signIn, signUp, error, clearError } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [info, setInfo] = useState(null)

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace('/')
    }
  }, [loading, isAuthenticated, router])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setInfo(null)
    clearError()

    if (mode === 'login') {
      const result = await signIn(email, password)
      if (!result.error) {
        router.replace('/')
      }
    } else {
      const result = await signUp(email, password)
      if (result.needsConfirmation) {
        setInfo(result.message)
      } else if (!result.error) {
        router.replace('/')
      }
    }
    setSubmitting(false)
  }

  const switchMode = (newMode) => {
    setMode(newMode)
    clearError()
    setInfo(null)
  }

  if (loading) {
    return (
      <div className="login-container">
        <p className="login-loading">認証を確認中...</p>
      </div>
    )
  }

  if (isAuthenticated) return null

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <span className="login-logo-icon">🎙️</span>
          <h1>Record App</h1>
        </div>

        <div className="login-tabs">
          <button
            className={`login-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
            type="button"
          >
            ログイン
          </button>
          <button
            className={`login-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => switchMode('signup')}
            type="button"
          >
            サインアップ
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="email">メールアドレス</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="login-field">
            <label htmlFor="password">パスワード</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6文字以上"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && <p className="login-error">{error}</p>}
          {info && <p className="login-info">{info}</p>}

          <button
            type="submit"
            className="login-submit"
            disabled={submitting}
          >
            {submitting
              ? '処理中...'
              : mode === 'login'
                ? 'ログイン'
                : 'アカウント作成'}
          </button>
        </form>
      </div>
    </div>
  )
}
