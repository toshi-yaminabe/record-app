'use client'

import { useEffect, useState } from 'react'
import { useApi } from '../../hooks/use-api'
import { LoadingSkeleton } from '../../components/loading-skeleton'
import { logger } from '@/lib/logger.js'
import './memories.css'

export function MemoryListView() {
  const { fetchApi, loading } = useApi()
  const [memories, setMemories] = useState([])
  const [newContent, setNewContent] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetchMemories()
  }, [])

  const fetchMemories = async () => {
    try {
      const data = await fetchApi('/api/memories')
      setMemories(data.memories || [])
    } catch (err) {
      logger.error('Failed to fetch memories', { error: err.message })
    }
  }

  const handleAdd = async () => {
    if (!newContent.trim()) return
    try {
      setAdding(true)
      const data = await fetchApi('/api/memories', {
        method: 'POST',
        body: JSON.stringify({ content: newContent.trim() }),
      })
      setMemories(prev => [data.memory, ...prev])
      setNewContent('')
    } catch (err) {
      alert('追加に失敗しました: ' + err.message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <section className="memory-list-view">
      <div className="memory-header">
        <h2>思い出ノート</h2>
      </div>

      <div className="memory-add">
        <textarea
          className="memory-textarea"
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          placeholder="新しいメモリーを入力..."
          rows={3}
        />
        <button
          className="btn-add-memory"
          onClick={handleAdd}
          disabled={adding || !newContent.trim()}
        >
          {adding ? '追加中...' : '新規メモリー追加'}
        </button>
      </div>

      {loading && <LoadingSkeleton rows={4} />}

      {!loading && memories.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">📖</span>
          <p>思い出がありません</p>
          <p className="empty-hint">録音データから自動的に思い出が抽出されます</p>
        </div>
      )}

      {!loading && memories.length > 0 && (
        <div className="memory-list">
          {memories.map(memory => (
            <div key={memory.id} className="memory-card">
              <div className="memory-meta">
                <span className="memory-date">
                  {new Date(memory.createdAt).toLocaleDateString('ja-JP')}
                </span>
              </div>
              <div className="memory-content">
                <p className="memory-text">{memory.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
