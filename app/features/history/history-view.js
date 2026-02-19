'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApi } from '@/app/hooks/use-api'

export function HistoryView() {
  const { fetchApi, loading, error } = useApi()
  const [transcripts, setTranscripts] = useState([])

  const fetchTranscripts = useCallback(async () => {
    try {
      const result = await fetchApi('/api/segments')
      setTranscripts((result.segments ?? []).slice(0, 10))
    } catch {
      // エラーは useApi の error ステートで管理
    }
  }, [fetchApi])

  useEffect(() => {
    fetchTranscripts()
  }, [fetchTranscripts])

  return (
    <section className="history-view">
      <div className="history-header">
        <h2>文字起こし履歴</h2>
        <button className="refresh-btn" onClick={fetchTranscripts}>
          🔄 更新
        </button>
      </div>

      {loading && <div className="loading-state">読み込み中...</div>}

      {!loading && error && (
        <div className="error-state">データの取得に失敗しました: {error}</div>
      )}

      {!loading && !error && transcripts.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">📭</span>
          <p>まだ文字起こしデータがありません</p>
          <p className="empty-hint">Flutterアプリで録音→送信してください</p>
        </div>
      )}

      {transcripts.length > 0 && (
        <div className="transcript-list">
          {transcripts.map((t, i) => (
            <div key={t.id || i} className="transcript-card">
              <div className="transcript-header">
                <span className="transcript-id">#{t.segmentNo}</span>
                <span className="transcript-session">{t.sessionId?.slice(0, 8)}</span>
                <span className="transcript-date">
                  {new Date(t.createdAt).toLocaleString('ja-JP')}
                </span>
              </div>
              <p className="transcript-text">
                {t.text?.slice(0, 200)}{t.text?.length > 200 ? '...' : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
