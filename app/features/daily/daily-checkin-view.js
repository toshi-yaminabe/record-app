'use client'

import { useEffect } from 'react'
import { useProposals } from '../../hooks/use-proposals'
import { ProposalCard } from './proposal-card'
import { LoadingSkeleton } from '../../components/loading-skeleton'
import './daily.css'

export function DailyCheckinView() {
  const { proposals, fetchProposals, generateProposals, confirmProposal, rejectProposal, loading } = useProposals()

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    fetchProposals(today)
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

  return (
    <section className="daily-checkin-view">
      <div className="daily-header">
        <h2>今日のチェックイン</h2>
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
          {proposals.map(proposal => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onConfirm={handleConfirm}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </section>
  )
}
