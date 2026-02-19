'use client'

import { StatusBadge } from '../../components/status-badge'
import { BunjinChip } from '../../components/bunjin-chip'

export function TaskItem({ task, onStatusChange }) {
  const handleCheckboxChange = () => {
    if (task.status === 'DONE') {
      onStatusChange(task.id, 'TODO')
      return
    }
    const progressMap = { TODO: 'DOING', DOING: 'DONE' }
    const nextStatus = progressMap[task.status]
    if (nextStatus) onStatusChange(task.id, nextStatus)
  }

  const handleArchive = () => {
    if (!window.confirm('このタスクをアーカイブしますか？')) return
    onStatusChange(task.id, 'ARCHIVED')
  }

  const ribbonColor = task.bunjin?.color || 'var(--accent-purple)'

  return (
    <div className="task-item">
      <div
        className="task-ribbon"
        style={{ backgroundColor: ribbonColor }}
      />
      <input
        type="checkbox"
        checked={task.status === 'DONE'}
        onChange={handleCheckboxChange}
        disabled={task.status === 'ARCHIVED'}
        className="task-checkbox"
      />
      <div className="task-content">
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          {task.bunjin && <BunjinChip bunjin={task.bunjin} size="small" />}
          <StatusBadge status={task.status} />
          {task.dueDate && (
            <span className="task-due">期限: {new Date(task.dueDate).toLocaleDateString('ja-JP')}</span>
          )}
          {task.status === 'DONE' && (
            <button className="btn-archive-link" onClick={handleArchive}>
              アーカイブ
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
