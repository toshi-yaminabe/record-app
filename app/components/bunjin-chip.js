'use client'

export function BunjinChip({ bunjin, size = 'medium' }) {
  const sizeClass = size === 'small' ? 'bunjin-chip-sm' : 'bunjin-chip-md'

  return (
    <span
      className={`bunjin-chip ${sizeClass}`}
      style={{ '--chip-color': bunjin.color || '#9c27b0' }}
    >
      {bunjin.displayName}
    </span>
  )
}
