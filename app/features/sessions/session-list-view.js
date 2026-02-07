'use client'

import { useEffect, useState } from 'react'
import { useApi } from '../../hooks/use-api'
import { LoadingSkeleton } from '../../components/loading-skeleton'
import './sessions.css'

export function SessionListView() {
  const { fetchApi, loading } = useApi()
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const data = await fetchApi('/api/sessions')
      setSessions(data.sessions || [])
    } catch (err) {
      console.error('Failed to fetch sessions:', err)
    }
  }

  return (
    <section className="session-list-view">
      <div className="session-header">
        <h2>録音セッション</h2>
        <button className="btn-refresh" onClick={fetchSessions}>
          🔄 更新
        </button>
      </div>

      {loading && <LoadingSkeleton rows={5} />}

      {!loading && sessions.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">🎙️</span>
          <p>セッションがありません</p>
          <p className="empty-hint">Flutterアプリで録音を開始してください</p>
        </div>
      )}

      {!loading && sessions.length > 0 && (
        <div className="session-list">
          {sessions.map(session => (
            <div key={session.id} className="session-card">
              <div className="session-header-info">
                <span className="session-id">{session.id.slice(0, 8)}</span>
                <span className="session-date">
                  {new Date(session.startedAt).toLocaleString('ja-JP')}
                </span>
              </div>
              <div className="session-stats">
                <div className="stat">
                  <span className="stat-label">セグメント数</span>
                  <span className="stat-value">{session.segmentCount || 0}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">合計時間</span>
                  <span className="stat-value">
                    {Math.round((session.segmentCount || 0) * 10)} 分
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
