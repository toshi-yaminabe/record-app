'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '../../hooks/use-api'
import { LoadingSkeleton } from '../../components/loading-skeleton'
import './weekly.css'

function getCurrentWeekKey() {
  const today = new Date()
  const year = today.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const dayOfYear = Math.floor((today - startOfYear) / (24 * 60 * 60 * 1000))
  const weekNum = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7)
  return `${year}-W${String(weekNum).padStart(2, '0')}`
}

export function WeeklyReviewView() {
  const { fetchApi, loading } = useApi()
  const [weekKey] = useState(() => getCurrentWeekKey())
  const [reviewData, setReviewData] = useState(null)

  const loadReview = useCallback(() => {
    fetchApi(`/api/weekly-review?weekKey=${weekKey}`)
      .then(data => setReviewData(data))
      .catch(() => setReviewData(null))
  }, [fetchApi, weekKey])

  useEffect(() => {
    loadReview()
  }, [loadReview])

  const executions = reviewData?.executions ?? []

  return (
    <section className="weekly-review-view">
      <div className="weekly-header">
        <h2>今週の振り返り</h2>
        <span className="week-label">週: {weekKey}</span>
      </div>

      {loading && <LoadingSkeleton rows={4} />}

      {!loading && executions.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">📅</span>
          <p>今週確定した提案がありません</p>
          <p className="empty-hint">Daily Check-inで提案を確定しましょう</p>
        </div>
      )}

      {!loading && executions.length > 0 && (
        <div className="weekly-summary">
          <div className="summary-stats">
            <div className="stat-card">
              <span className="stat-value">{executions.length}</span>
              <span className="stat-label">実行済み提案</span>
            </div>
          </div>
          <div className="confirmed-list">
            {executions.map(exec => (
              <div key={exec.id} className="confirmed-item">
                <div className="confirmed-meta">
                  <span className="execution-date">
                    {new Date(exec.createdAt).toLocaleDateString('ja-JP')}
                  </span>
                  <span className="execution-badge">実行済み</span>
                </div>
                <h3 className="confirmed-title">{exec.proposal?.title}</h3>
                <p className="confirmed-body">{exec.proposal?.body}</p>
                {exec.note && (
                  <p className="execution-note">メモ: {exec.note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
