'use client'

const statusConfig = {
  TODO: { color: '#2196f3', label: 'TODO' },
  DOING: { color: '#ff9800', label: 'DOING' },
  DONE: { color: '#00e676', label: 'DONE' },
  ARCHIVED: { color: '#9e9e9e', label: 'ARCHIVED' },
}

export function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.TODO

  return (
    <span
      className="status-badge"
      style={{ '--badge-color': config.color }}
    >
      {config.label}
    </span>
  )
}
