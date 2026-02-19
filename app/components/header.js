'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/app/contexts/auth-context'
import { useApi } from '@/app/hooks/use-api'

export function Header() {
  const [sessionStatus, setSessionStatus] = useState(null)
  const { user, accessToken, signOut } = useAuth()
  const { fetchApi } = useApi()

  const fetchSessionStatus = useCallback(async () => {
    try {
      const data = await fetchApi('/api/sessions?limit=1')
      const latest = data.sessions?.[0]
      setSessionStatus(latest?.status ?? null)
    } catch (err) {
      console.error('Failed to fetch session status:', err)
    }
  }, [fetchApi])

  useEffect(() => {
    fetchSessionStatus()
    const interval = setInterval(fetchSessionStatus, 30000)
    return () => clearInterval(interval)
  }, [fetchSessionStatus, accessToken])

  const isActive = sessionStatus === 'ACTIVE'

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <span className="logo-icon">🎙️</span>
          <h1>Record App</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="session-status">
            {isActive ? (
              <span className="status-active">
                <span className="status-dot blink" />
                録音中
              </span>
            ) : (
              <span className="status-stopped">停止中</span>
            )}
          </div>
          {user && (
            <div className="user-menu">
              <span className="user-email">{user.email}</span>
              <button className="logout-btn" onClick={signOut}>
                ログアウト
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="tagline">音声録音 → AI文字起こし → クラウド保存</p>
    </header>
  )
}
