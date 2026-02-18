'use client'

import { useEffect, useState } from 'react'

export function Header() {
  const [sessionStatus, setSessionStatus] = useState(null)

  useEffect(() => {
    fetchSessionStatus()
    const interval = setInterval(fetchSessionStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchSessionStatus = async () => {
    try {
      const res = await fetch('/api/sessions?limit=1')
      if (!res.ok) return
      const data = await res.json()
      const latest = data.sessions?.[0]
      setSessionStatus(latest?.status ?? null)
    } catch {
      // ネットワークエラーは無視
    }
  }

  const isActive = sessionStatus === 'ACTIVE'

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <span className="logo-icon">🎙️</span>
          <h1>Record App</h1>
        </div>
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
      </div>
      <p className="tagline">音声録音 → AI文字起こし → クラウド保存</p>
    </header>
  )
}
