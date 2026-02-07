'use client'

import { useState, useCallback } from 'react'
import { useApi } from './use-api'

export function useTasks() {
  const { fetchApi, loading, error } = useApi()
  const [tasks, setTasks] = useState([])

  const fetchTasks = useCallback(async (filters = {}) => {
    try {
      const params = new URLSearchParams()
      if (filters.bunjinId) params.append('bunjinId', filters.bunjinId)
      if (filters.status) params.append('status', filters.status)

      const data = await fetchApi(`/api/tasks?${params.toString()}`)
      setTasks(data.tasks || [])
      return data.tasks
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
      return []
    }
  }, [fetchApi])

  const createTask = useCallback(async (taskData) => {
    try {
      const data = await fetchApi('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData),
      })
      setTasks(prev => [...prev, data.task])
      return data.task
    } catch (err) {
      console.error('Failed to create task:', err)
      throw err
    }
  }, [fetchApi])

  const updateTaskStatus = useCallback(async (taskId, newStatus) => {
    try {
      const data = await fetchApi(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      setTasks(prev => prev.map(t => t.id === taskId ? data.task : t))
      return data.task
    } catch (err) {
      console.error('Failed to update task:', err)
      throw err
    }
  }, [fetchApi])

  return { tasks, fetchTasks, createTask, updateTaskStatus, loading, error }
}
