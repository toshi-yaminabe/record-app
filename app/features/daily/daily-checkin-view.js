'use client'

import { useEffect, useState } from 'react'
import { useProposals } from '../../hooks/use-proposals'
import { ProposalCard } from './proposal-card'
import { LoadingSkeleton } from '../../components/loading-skeleton'
import { SwlsFormView } from '../swls/swls-form-view'
import './daily.css'

const HANDLED_STATUSES = ['CONFIRMED', 'REJECTED']

export function DailyCheckinView() {
  const { proposals, fetchProposals, generateProposals, confirmProposal, rejectProposal, loading } = useProposals()
  const [handledExpanded, setHandledExpanded] = useState(false)

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    fetchProposals(today)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGenerate = async () => {
    await generateProposals()
  }

  const handleConfirm = async (proposalId) => {
    await confirmProposal(proposalId)
  }

  const handleReject = async (proposalId) => {
    await rejectProposal(proposalId)
  }

  const pendingProposals = proposals.filter(p => !HANDLED_STATUSES.includes(p.status))
  const handledProposals = proposals.filter(p => HANDLED_STATUSES.includes(p.status))

  return (
    <section className="daily-checkin-view">
      <div className="daily-header">
        <div className="daily-title-row">
          <h2>今日のチェックイン</h2>
          {pendingProposals.length > 0 && (
            <span className="pending-badge">{pendingProposals.length} 件未対応</span>
          )}
        </div>
        <button className="btn-generate" onClick={handleGenerate} disabled={loading}>
          {loading ? '生成中...' : '🤖 提案を生成'}
        </button>
      </div>

      {loading && <LoadingSkeleton rows={3} />}

      {!loading && proposals.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">💡</span>
          <p>今日の提案がありません</p>
          <p className="empty-hint">「提案を生成」ボタンでAIがタスクを提案します</p>
        </div>
      )}

      {!loading && proposals.length > 0 && (
        <div className="proposal-list">
          {pendingProposals.map(proposal => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onConfirm={handleConfirm}
              onReject={handleReject}
            />
          ))}

          {handledProposals.length > 0 && (
            <div className="handled-section">
              <button
                className="handled-toggle"
                onClick={() => setHandledExpanded(prev => !prev)}
              >
                {handledExpanded ? '▲' : '▼'} 対応済み ({handledProposals.length} 件)
              </button>
              {handledExpanded && handledProposals.map(proposal => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onConfirm={handleConfirm}
                  onReject={handleReject}
                />
              ))}
            </div>
          )}
        </div>
      )}
      <hr className="daily-divider" />
      <SwlsFormView />
    </section>
  )
}
