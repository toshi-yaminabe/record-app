'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '../../hooks/use-api'
import { logger } from '@/lib/logger.js'
import './swls.css'

const questions = [
  { id: 1, text: 'ほとんどの面で、私の人生は理想に近い' },
  { id: 2, text: '私の人生の状態は素晴らしい' },
  { id: 3, text: '私は自分の人生に満足している' },
  { id: 4, text: 'これまでに私は人生で求める大切なものを得てきた' },
  { id: 5, text: 'もう一度人生をやり直せるとしても、ほとんど何も変えないだろう' },
]

const SCALE = [1, 2, 3, 4, 5, 6, 7]

export function SwlsFormView() {
  const { fetchApi, loading } = useApi()
  const [responses, setResponses] = useState({})
  const [lastSubmitted, setLastSubmitted] = useState(null)
  const [submitStatus, setSubmitStatus] = useState(null)

  const fetchLatestResponse = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const data = await fetchApi(`/api/swls?dateKey=${today}`)
      if (data.response) {
        const r = data.response
        const loaded = {}
        if (r.q1) loaded[1] = Number(r.q1)
        if (r.q2) loaded[2] = Number(r.q2)
        if (r.q3) loaded[3] = Number(r.q3)
        if (r.q4) loaded[4] = Number(r.q4)
        if (r.q5) loaded[5] = Number(r.q5)
        setResponses(loaded)
        setLastSubmitted(r.createdAt)
      }
    } catch (err) {
      logger.error('Failed to fetch SWLS', { error: err.message })
    }
  }, [fetchApi])

  useEffect(() => {
    fetchLatestResponse()
  }, [fetchLatestResponse])

  const handleSelect = (questionId, value) => {
    setResponses(prev => ({ ...prev, [questionId]: value }))
  }

  const totalScore = questions.reduce((sum, q) => sum + (responses[q.id] || 0), 0)
  const allAnswered = questions.every(q => responses[q.id] != null)

  const handleSubmit = async () => {
    setSubmitStatus(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      await fetchApi('/api/swls', {
        method: 'POST',
        body: JSON.stringify({
          dateKey: today,
          q1: responses[1] != null ? String(responses[1]) : undefined,
          q2: responses[2] != null ? String(responses[2]) : undefined,
          q3: responses[3] != null ? String(responses[3]) : undefined,
          q4: responses[4] != null ? String(responses[4]) : undefined,
          q5: responses[5] != null ? String(responses[5]) : undefined,
        }),
      })
      setSubmitStatus({ type: 'success', message: '回答を保存しました' })
      setLastSubmitted(new Date().toISOString())
    } catch (err) {
      setSubmitStatus({ type: 'error', message: '保存に失敗しました: ' + err.message })
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
        <p>各項目について、1（全く同意しない）〜7（強く同意する）で評価してください</p>
      </div>

      <div className="swls-questions">
        {questions.map(q => (
          <div key={q.id} className="swls-question">
            <label className="question-label">
              {q.id}. {q.text}
            </label>
            <div className="likert-scale">
              <div className="likert-track" aria-hidden="true" />
              {SCALE.map(val => (
                <label key={val} className="likert-option">
                  <input
                    type="radio"
                    name={`q${q.id}`}
                    value={val}
                    checked={responses[q.id] === val}
                    onChange={() => handleSelect(q.id, val)}
                  />
                  <span className="likert-label">{val}</span>
                </label>
              ))}
            </div>
            <div className="likert-legend">
              <span>全く同意しない</span>
              <span>中立</span>
              <span>強く同意する</span>
            </div>
          </div>
        ))}
      </div>

      {allAnswered && (
        <div className="swls-total">
          <span className="total-label">合計スコア:</span>
          <span className="total-score">{totalScore}</span>
          <span className="total-range">/ 35</span>
        </div>
      )}

      {submitStatus && (
        <div className={`swls-status swls-status--${submitStatus.type}`}>
          {submitStatus.message}
        </div>
      )}

      <div className="swls-actions">
        <button className="btn-submit" onClick={handleSubmit} disabled={loading || !allAnswered}>
          {loading ? '保存中...' : '回答を保存'}
        </button>
      </div>
    </section>
  )
}
