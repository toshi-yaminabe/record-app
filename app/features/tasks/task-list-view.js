'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTasks } from '../../hooks/use-tasks'
import { useBunjins } from '../../hooks/use-bunjins'
import { TaskItem } from './task-item'
import { LoadingSkeleton } from '../../components/loading-skeleton'
import './tasks.css'

export function TaskListView() {
  const { tasks, fetchTasks, updateTaskStatus, loading } = useTasks()
  const { bunjins, fetchBunjins } = useBunjins()
  const [selectedBunjinId, setSelectedBunjinId] = useState('')

  const loadData = useCallback(() => {
    fetchTasks({ bunjinId: selectedBunjinId || undefined })
    fetchBunjins()
  }, [fetchTasks, fetchBunjins, selectedBunjinId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleStatusChange = async (taskId, newStatus) => {
    await updateTaskStatus(taskId, newStatus)
    await fetchTasks({ bunjinId: selectedBunjinId || undefined })
  }

  return (
    <section className="task-list-view">
      <div className="task-list-header">
        <h2>タスク管理</h2>
        <select
          className="bunjin-filter"
          value={selectedBunjinId}
          onChange={(e) => setSelectedBunjinId(e.target.value)}
        >
          <option value="">全ての分人</option>
          {bunjins.map(b => (
            <option key={b.id} value={b.id}>{b.displayName}</option>
          ))}
        </select>
      </div>

      {loading && <LoadingSkeleton rows={5} />}

      {!loading && tasks.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">📝</span>
          <p>タスクがありません</p>
          <p className="empty-hint">Daily Check-inで提案を確定するとタスクが作成されます</p>
        </div>
      )}

      {!loading && tasks.length > 0 && (
        <div className="task-list">
          {tasks.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </section>
  )
}
