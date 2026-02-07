'use client'

import { useEffect, useState } from 'react'
import { useApi } from '../../hooks/use-api'
import './swls.css'

const questions = [
  { id: 1, text: 'ほとんどの面で、私の人生は私の理想に近い' },
  { id: 2, text: '私の人生は、とても素晴らしい状態だ' },
  { id: 3, text: '私は自分の人生に満足している' },
  { id: 4, text: '私はこれまで、自分の人生に求める大切なものを得てきた' },
  { id: 5, text: 'もう一度人生をやり直せるとしても、ほとんど何も変えないだろう' },
]

export function SwlsFormView() {
  const { fetchApi, loading } = useApi()
  const [responses, setResponses] = useState({})
  const [lastSubmitted, setLastSubmitted] = useState(null)

  useEffect(() => {
    fetchLatestResponse()
  }, [])

  const fetchLatestResponse = async () => {
    try {
      const data = await fetchApi('/api/swls/latest')
      if (data.response) {
        setResponses(data.response.answers || {})
        setLastSubmitted(data.response.createdAt)
      }
    } catch (err) {
      console.error('Failed to fetch SWLS:', err)
    }
  }

  const handleChange = (questionId, value) => {
    setResponses(prev => ({ ...prev, [questionId]: value }))
  }

  const handleSubmit = async () => {
    try {
      await fetchApi('/api/swls', {
        method: 'POST',
        body: JSON.stringify({ answers: responses }),
      })
      alert('回答を保存しました')
      setLastSubmitted(new Date().toISOString())
    } catch (err) {
      alert('保存に失敗しました: ' + err.message)
    }
  }

  return (
    <section className="swls-form-view">
      <div className="swls-header">
        <h2>人生満足度尺度 (SWLS)</h2>
        {lastSubmitted && (
          <span className="last-submitted">
            最終回答: {new Date(lastSubmitted).toLocaleDateString('ja-JP')}
          </span>
        )}
      </div>

      <div className="swls-description">
        <p>各項目について、現在のあなたの気持ちに最も近いものを自由に記入してください（任意）</p>
      </div>

      <div className="swls-questions">
        {questions.map(q => (
          <div key={q.id} className="swls-question">
            <label className="question-label">
              {q.id}. {q.text}
            </label>
            <textarea
              className="question-input"
              value={responses[q.id] || ''}
              onChange={(e) => handleChange(q.id, e.target.value)}
              placeholder="自由記述（任意）"
              rows={3}
            />
          </div>
        ))}
      </div>

      <div className="swls-actions">
        <button className="btn-submit" onClick={handleSubmit} disabled={loading}>
          {loading ? '保存中...' : '回答を保存'}
        </button>
      </div>
    </section>
  )
}
