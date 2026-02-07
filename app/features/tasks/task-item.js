'use client'

import { StatusBadge } from '../../components/status-badge'
import { BunjinChip } from '../../components/bunjin-chip'

export function TaskItem({ task, onStatusChange }) {
  const handleCheckboxChange = () => {
    let nextStatus = 'TODO'
    if (task.status === 'TODO') nextStatus = 'DOING'
    else if (task.status === 'DOING') nextStatus = 'DONE'
    else if (task.status === 'DONE') nextStatus = 'ARCHIVED'

    onStatusChange(task.id, nextStatus)
  }

  return (
    <div className="task-item">
      <input
        type="checkbox"
        checked={task.status === 'DONE' || task.status === 'ARCHIVED'}
        onChange={handleCheckboxChange}
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
        </div>
      </div>
    </div>
  )
}
