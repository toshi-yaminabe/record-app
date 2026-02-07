'use client'

import { BunjinChip } from '../../components/bunjin-chip'

export function ProposalCard({ proposal, onConfirm, onReject }) {
  return (
    <div className="proposal-card">
      <div className="proposal-header">
        <h3 className="proposal-title">{proposal.title}</h3>
        {proposal.bunjin && <BunjinChip bunjin={proposal.bunjin} />}
      </div>
      <p className="proposal-body">{proposal.body}</p>
      <div className="proposal-actions">
        <button className="btn-confirm" onClick={() => onConfirm(proposal.id)}>
          ✓ 確定
        </button>
        <button className="btn-reject" onClick={() => onReject(proposal.id)}>
          ✕ 却下
        </button>
      </div>
    </div>
  )
}
