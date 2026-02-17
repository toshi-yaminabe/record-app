'use client'

import { useState, useCallback } from 'react'
import { useApi } from './use-api'
import { logger } from '@/lib/logger.js'

export function useBunjins() {
  const { fetchApi, loading, error } = useApi()
  const [bunjins, setBunjins] = useState([])

  const fetchBunjins = useCallback(async () => {
    try {
      const data = await fetchApi('/api/bunjins')
      setBunjins(data.bunjins || [])
      return data.bunjins
    } catch (err) {
      logger.error('Failed to fetch bunjins', { error: err.message })
      return []
    }
  }, [fetchApi])

  const createBunjin = useCallback(async (bunjinData) => {
    try {
      const data = await fetchApi('/api/bunjins', {
        method: 'POST',
        body: JSON.stringify(bunjinData),
      })
      setBunjins(prev => [...prev, data.bunjin])
      return data.bunjin
    } catch (err) {
      logger.error('Failed to create bunjin', { error: err.message })
      throw err
    }
  }, [fetchApi])

  const deleteBunjin = useCallback(async (bunjinId) => {
    try {
      await fetchApi(`/api/bunjins/${bunjinId}`, {
        method: 'DELETE',
      })
      setBunjins(prev => prev.filter(b => b.id !== bunjinId))
    } catch (err) {
      logger.error('Failed to delete bunjin', { error: err.message })
      throw err
    }
  }, [fetchApi])

  return { bunjins, fetchBunjins, createBunjin, deleteBunjin, loading, error }
}
