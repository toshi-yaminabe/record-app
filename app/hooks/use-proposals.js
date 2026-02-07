'use client'

import { useState, useCallback } from 'react'
import { useApi } from './use-api'

export function useProposals() {
  const { fetchApi, loading, error } = useApi()
  const [proposals, setProposals] = useState([])

  const fetchProposals = useCallback(async (date = null) => {
    try {
      const params = new URLSearchParams()
      if (date) params.append('date', date)

      const data = await fetchApi(`/api/proposals?${params.toString()}`)
      setProposals(data.proposals || [])
      return data.proposals
    } catch (err) {
      console.error('Failed to fetch proposals:', err)
      return []
    }
  }, [fetchApi])

  const generateProposals = useCallback(async () => {
    try {
      const data = await fetchApi('/api/proposals/generate', {
        method: 'POST',
      })
      setProposals(data.proposals || [])
      return data.proposals
    } catch (err) {
      console.error('Failed to generate proposals:', err)
      throw err
    }
  }, [fetchApi])

  const confirmProposal = useCallback(async (proposalId) => {
    try {
      const data = await fetchApi(`/api/proposals/${proposalId}/confirm`, {
        method: 'POST',
      })
      setProposals(prev => prev.map(p => p.id === proposalId ? data.proposal : p))
      return data.proposal
    } catch (err) {
      console.error('Failed to confirm proposal:', err)
      throw err
    }
  }, [fetchApi])

  const rejectProposal = useCallback(async (proposalId) => {
    try {
      const data = await fetchApi(`/api/proposals/${proposalId}/reject`, {
        method: 'POST',
      })
      setProposals(prev => prev.filter(p => p.id !== proposalId))
      return data
    } catch (err) {
      console.error('Failed to reject proposal:', err)
      throw err
    }
  }, [fetchApi])

  return { proposals, fetchProposals, generateProposals, confirmProposal, rejectProposal, loading, error }
}
