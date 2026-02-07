'use client'

import { useEffect, useState } from 'react'
import { useBunjins } from '../../hooks/use-bunjins'
import { RuleTreeEditor } from './rule-tree-editor'
import { LoadingSkeleton } from '../../components/loading-skeleton'
import './bunjins.css'

export function BunjinManagerView() {
  const { bunjins, fetchBunjins, createBunjin, deleteBunjin, loading } = useBunjins()
  const [newBunjinName, setNewBunjinName] = useState('')
  const [selectedBunjin, setSelectedBunjin] = useState(null)

  useEffect(() => {
    fetchBunjins()
  }, [])

  const customBunjins = bunjins.filter(b => !b.isDefault)
  const canAddCustom = customBunjins.length < 3

  const handleCreate = async () => {
    if (!newBunjinName.trim()) return
    if (!canAddCustom) {
      alert('カスタム分人は最大3つまでです')
      return
    }

    try {
      await createBunjin({ name: newBunjinName.trim() })
      setNewBunjinName('')
    } catch (err) {
      alert('作成に失敗しました: ' + err.message)
    }
  }

  const handleDelete = async (bunjinId) => {
    if (!confirm('この分人を削除しますか？')) return
    try {
      await deleteBunjin(bunjinId)
      if (selectedBunjin?.id === bunjinId) {
        setSelectedBunjin(null)
      }
    } catch (err) {
      alert('削除に失敗しました: ' + err.message)
    }
  }

  return (
    <section className="bunjin-manager-view">
      <div className="bunjin-header">
        <h2>分人管理</h2>
      </div>

      {loading && <LoadingSkeleton rows={4} />}

      {!loading && (
        <div className="bunjin-content">
          <div className="bunjin-list-section">
            <h3>デフォルト分人</h3>
            <div className="bunjin-grid">
              {bunjins.filter(b => b.isDefault).map(b => (
                <div
                  key={b.id}
                  className="bunjin-card default"
                  style={{ '--card-color': b.color }}
                  onClick={() => setSelectedBunjin(b)}
                >
                  <span className="bunjin-name">{b.name}</span>
                </div>
              ))}
            </div>

            <h3>カスタム分人 ({customBunjins.length}/3)</h3>
            <div className="bunjin-grid">
              {customBunjins.map(b => (
                <div
                  key={b.id}
                  className="bunjin-card custom"
                  style={{ '--card-color': b.color }}
                >
                  <span className="bunjin-name" onClick={() => setSelectedBunjin(b)}>
                    {b.name}
                  </span>
                  <button
                    className="btn-delete"
                    onClick={() => handleDelete(b.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {canAddCustom && (
              <div className="bunjin-create">
                <input
                  type="text"
                  placeholder="新しい分人名"
                  value={newBunjinName}
                  onChange={(e) => setNewBunjinName(e.target.value)}
                  className="bunjin-input"
                />
                <button className="btn-create" onClick={handleCreate}>
                  追加
                </button>
              </div>
            )}
          </div>

          {selectedBunjin && (
            <div className="bunjin-detail-section">
              <h3>{selectedBunjin.name}</h3>
              <RuleTreeEditor ruleTree={selectedBunjin.ruleTree} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}
