'use client'

import { useState, useCallback } from 'react'

export function useApi() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchApi = useCallback(async (url, options = {}) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { fetchApi, loading, error }
}
