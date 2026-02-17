'use client'

import { useEffect, useState } from 'react'
import { useApi } from '../../hooks/use-api'
import { LoadingSkeleton } from '../../components/loading-skeleton'
import { logger } from '@/lib/logger.js'
import './memories.css'

export function MemoryListView() {
  const { fetchApi, loading } = useApi()
  const [memories, setMemories] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')

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

  const handleEdit = (memory) => {
    setEditingId(memory.id)
    setEditText(memory.content)
  }

  const handleSave = async (memoryId) => {
    try {
      await fetchApi(`/api/memories/${memoryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: editText }),
      })
      setMemories(prev => prev.map(m => m.id === memoryId ? { ...m, content: editText } : m))
      setEditingId(null)
    } catch (err) {
      alert('保存に失敗しました: ' + err.message)
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditText('')
  }

  return (
    <section className="memory-list-view">
      <div className="memory-header">
        <h2>思い出ノート</h2>
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
              {editingId === memory.id ? (
                <div className="memory-edit">
                  <textarea
                    className="memory-textarea"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={4}
                  />
                  <div className="memory-edit-actions">
                    <button className="btn-save" onClick={() => handleSave(memory.id)}>
                      保存
                    </button>
                    <button className="btn-cancel" onClick={handleCancel}>
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <div className="memory-content">
                  <p className="memory-text">{memory.content}</p>
                  <button className="btn-edit" onClick={() => handleEdit(memory)}>
                    編集
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
