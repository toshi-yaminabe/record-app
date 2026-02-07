'use client'

import { useState, useCallback } from 'react'
import { useApi } from './use-api'

export function useBunjins() {
  const { fetchApi, loading, error } = useApi()
  const [bunjins, setBunjins] = useState([])

  const fetchBunjins = useCallback(async () => {
    try {
      const data = await fetchApi('/api/bunjins')
      setBunjins(data.bunjins || [])
      return data.bunjins
    } catch (err) {
      console.error('Failed to fetch bunjins:', err)
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
      console.error('Failed to create bunjin:', err)
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
      console.error('Failed to delete bunjin:', err)
      throw err
    }
  }, [fetchApi])

  return { bunjins, fetchBunjins, createBunjin, deleteBunjin, loading, error }
}
