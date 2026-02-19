'use client'

import { getBunjinSignature } from '../utils/bunjin-signatures'

export function BunjinChip({ bunjin, size = 'medium' }) {
  const sizeClass = size === 'small' ? 'bunjin-chip-sm' : 'bunjin-chip-md'
  const signature = getBunjinSignature(bunjin)

  return (
    <span
      className={`bunjin-chip ${sizeClass}`}
      style={{ '--chip-color': bunjin.color || '#9c27b0' }}
      title={`${bunjin.displayName}｜${signature.shortLabel}`}
    >
      <span className={`bunjin-shape bunjin-shape-${signature.shape}`}>{signature.icon}</span>
      <span className="bunjin-chip-name">{bunjin.displayName}</span>
      <span className="bunjin-chip-divider">|</span>
      <span className="bunjin-chip-label">{signature.shortLabel}</span>
    </span>
  )
}
