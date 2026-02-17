'use client'

import { useState, useCallback } from 'react'
import { useApi } from './use-api'
import { logger } from '@/lib/logger.js'

export function useProposals() {
  const { fetchApi, loading, error } = useApi()
  const [proposals, setProposals] = useState([])

  const fetchProposals = useCallback(async (dateKey = null) => {
    try {
      const params = new URLSearchParams()
      if (dateKey) params.append('dateKey', dateKey)

      const data = await fetchApi(`/api/proposals?${params.toString()}`)
      setProposals(data.proposals || [])
      return data.proposals
    } catch (err) {
      logger.error('Failed to fetch proposals', { error: err.message })
      return []
    }
  }, [fetchApi])

  const generateProposals = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const data = await fetchApi('/api/proposals', {
        method: 'POST',
        body: JSON.stringify({ dateKey: today }),
      })
      setProposals(data.proposals || [])
      return data.proposals
    } catch (err) {
      logger.error('Failed to generate proposals', { error: err.message })
      throw err
    }
  }, [fetchApi])

  const confirmProposal = useCallback(async (proposalId) => {
    try {
      const data = await fetchApi(`/api/proposals/${proposalId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CONFIRMED' }),
      })
      setProposals(prev => prev.map(p => p.id === proposalId ? data.proposal : p))
      return data.proposal
    } catch (err) {
      logger.error('Failed to confirm proposal', { error: err.message })
      throw err
    }
  }, [fetchApi])

  const rejectProposal = useCallback(async (proposalId) => {
    try {
      const data = await fetchApi(`/api/proposals/${proposalId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'REJECTED' }),
      })
      setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: 'REJECTED' } : p))
      return data
    } catch (err) {
      logger.error('Failed to reject proposal', { error: err.message })
      throw err
    }
  }, [fetchApi])

  return { proposals, fetchProposals, generateProposals, confirmProposal, rejectProposal, loading, error }
}
