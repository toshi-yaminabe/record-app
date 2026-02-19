'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/app/contexts/auth-context'

export function useApi() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { accessToken } = useAuth()

  const fetchApi = useCallback(async (url, options = {}) => {
    setLoading(true)
    setError(null)
    try {
      const headers = { 'Content-Type': 'application/json', ...options.headers }
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }
      const res = await fetch(url, { ...options, headers })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Request failed')
      return json.data ?? json
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  return { fetchApi, loading, error }
}
