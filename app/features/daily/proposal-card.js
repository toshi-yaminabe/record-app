'use client'

import { BunjinChip } from '../../components/bunjin-chip'

const HANDLED_STATUSES = ['CONFIRMED', 'REJECTED']

export function ProposalCard({ proposal, onConfirm, onReject }) {
  const isHandled = HANDLED_STATUSES.includes(proposal.status)
  const statusLabel = proposal.status === 'CONFIRMED' ? '確定済み' : proposal.status === 'REJECTED' ? '却下済み' : null

  return (
    <div className="proposal-card" style={isHandled ? { opacity: 0.5 } : undefined}>
      <div className="proposal-header">
        <h3 className="proposal-title">{proposal.title}</h3>
        <div className="proposal-header-right">
          {proposal.bunjin && <BunjinChip bunjin={proposal.bunjin} />}
          {statusLabel && <span className="proposal-status-label">{statusLabel}</span>}
        </div>
      </div>
      <p className="proposal-body">{proposal.body}</p>
      {!isHandled && (
        <div className="proposal-actions">
          <button className="btn-confirm" onClick={() => onConfirm(proposal.id)}>
            ✓ 確定
          </button>
          <button className="btn-reject" onClick={() => onReject(proposal.id)}>
            ✕ 却下
          </button>
        </div>
      )}
    </div>
  )
}
