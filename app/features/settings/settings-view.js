'use client'

import { useState, useEffect, useCallback } from 'react'
import { InstallView } from '../install/install-view'
import { logger } from '@/lib/logger.js'
import styles from './settings-view.module.css'

/**
 * 設定画面 - APIキー管理 + 開発者ツール
 */
export function SettingsView() {
  const [hasKey, setHasKey] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setHasKey(data.settings.hasGeminiApiKey)
        setUpdatedAt(data.settings.updatedAt)
      }
    } catch (error) {
      logger.error('Failed to fetch settings', { error: error.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'APIキーを入力してください' })
      return
    }

    try {
      setSaving(true)
      setMessage(null)
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiApiKey: apiKey.trim() }),
      })

      if (res.ok) {
        const data = await res.json()
        setHasKey(data.settings.hasGeminiApiKey)
        setUpdatedAt(data.settings.updatedAt)
        setApiKey('')
        setMessage({ type: 'success', text: 'APIキーを保存しました' })
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || '保存に失敗しました' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '通信エラーが発生しました' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('APIキーを削除しますか？Gemini機能が無効になります。')) return

    try {
      setSaving(true)
      setMessage(null)
      const res = await fetch('/api/settings', { method: 'DELETE' })

      if (res.ok) {
        setHasKey(false)
        setUpdatedAt(null)
        setMessage({ type: 'success', text: 'APIキーを削除しました' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '削除に失敗しました' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles['settings-view']}>
      {/* APIキー設定カード */}
      <div className={styles['settings-card']}>
        <div className={styles['settings-header']}>
          <span className={styles['settings-icon']}>🔑</span>
          <div>
            <h3>Gemini APIキー</h3>
            <p>音声文字起こし・提案生成に使用します</p>
          </div>
        </div>

        <div className={styles['settings-status']}>
          <div className={`${styles['status-badge']} ${hasKey ? styles['status-active'] : styles['status-inactive']}`}>
            {loading ? '確認中...' : hasKey ? '設定済み' : '未設定'}
          </div>
          {updatedAt && (
            <span className={styles['status-date']}>
              最終更新: {new Date(updatedAt).toLocaleString('ja-JP')}
            </span>
          )}
        </div>

        <div className={styles['settings-form']}>
          <div className={styles['input-group']}>
            <label htmlFor="apiKey">
              {hasKey ? '新しいAPIキーで上書き' : 'APIキーを入力'}
            </label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              className={styles['settings-input']}
              disabled={saving}
            />
          </div>

          <div className={styles['settings-actions']}>
            <button
              onClick={handleSave}
              disabled={saving || !apiKey.trim()}
              className={styles['btn-primary']}
            >
              {saving ? '保存中...' : '保存'}
            </button>
            {hasKey && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className={styles['btn-danger']}
              >
                削除
              </button>
            )}
          </div>
        </div>

        {message && (
          <div className={`${styles['settings-message']} ${styles[message.type]}`}>
            {message.text}
          </div>
        )}

        <div className={styles['settings-help']}>
          <p>
            <strong>APIキーの取得方法:</strong>
          </p>
          <ol>
            <li>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google AI Studio
              </a>
              にアクセス
            </li>
            <li>「Create API Key」をクリック</li>
            <li>生成されたキーをコピーして上の入力欄に貼り付け</li>
          </ol>
          <p className={styles['settings-note']}>
            APIキーはAES-256-GCMで暗号化してサーバーに保存されます。
            環境変数にGEMINI_API_KEYが設定されている場合、そちらが優先されます。
          </p>
        </div>
      </div>

      {/* 開発者ツール（既存） */}
      <InstallView />
    </section>
  )
}
