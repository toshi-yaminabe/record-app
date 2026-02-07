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
      const today = new Date().toISOString().slice(0, 10)
      const data = await fetchApi(`/api/swls?dateKey=${today}`)
      if (data.response) {
        const r = data.response
        const loaded = {}
        if (r.q1) loaded[1] = r.q1
        if (r.q2) loaded[2] = r.q2
        if (r.q3) loaded[3] = r.q3
        if (r.q4) loaded[4] = r.q4
        if (r.q5) loaded[5] = r.q5
        setResponses(loaded)
        setLastSubmitted(r.createdAt)
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
      const today = new Date().toISOString().slice(0, 10)
      await fetchApi('/api/swls', {
        method: 'POST',
        body: JSON.stringify({
          dateKey: today,
          q1: responses[1] || undefined,
          q2: responses[2] || undefined,
          q3: responses[3] || undefined,
          q4: responses[4] || undefined,
          q5: responses[5] || undefined,
        }),
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
