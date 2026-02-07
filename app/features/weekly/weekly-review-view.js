'use client'

import { useEffect, useState } from 'react'
import { useProposals } from '../../hooks/use-proposals'
import { LoadingSkeleton } from '../../components/loading-skeleton'
import './weekly.css'

export function WeeklyReviewView() {
  const { proposals, fetchProposals, loading } = useProposals()
  const [weekStart, setWeekStart] = useState('')

  useEffect(() => {
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - today.getDay() + 1)
    const weekStartStr = monday.toISOString().split('T')[0]
    setWeekStart(weekStartStr)
    fetchProposals(weekStartStr)
  }, [])

  const confirmedProposals = proposals.filter(p => p.status === 'CONFIRMED')

  return (
    <section className="weekly-review-view">
      <div className="weekly-header">
        <h2>今週の振り返り</h2>
        {weekStart && (
          <span className="week-label">
            週開始: {new Date(weekStart).toLocaleDateString('ja-JP')}
          </span>
        )}
      </div>

      {loading && <LoadingSkeleton rows={4} />}

      {!loading && confirmedProposals.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">📅</span>
          <p>今週確定した提案がありません</p>
          <p className="empty-hint">Daily Check-inで提案を確定しましょう</p>
        </div>
      )}

      {!loading && confirmedProposals.length > 0 && (
        <div className="weekly-summary">
          <div className="summary-stats">
            <div className="stat-card">
              <span className="stat-value">{confirmedProposals.length}</span>
              <span className="stat-label">確定済み提案</span>
            </div>
          </div>
          <div className="confirmed-list">
            {confirmedProposals.map(proposal => (
              <div key={proposal.id} className="confirmed-item">
                <div className="confirmed-date">
                  {new Date(proposal.createdAt).toLocaleDateString('ja-JP')}
                </div>
                <h3 className="confirmed-title">{proposal.title}</h3>
                <p className="confirmed-body">{proposal.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
