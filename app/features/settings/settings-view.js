'use client'

import { useState, useEffect, useCallback } from 'react'
import { InstallView } from '../install/install-view'

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
      console.error('Failed to fetch settings:', error)
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
    <section className="settings-view">
      {/* APIキー設定カード */}
      <div className="settings-card">
        <div className="settings-header">
          <span className="settings-icon">🔑</span>
          <div>
            <h3>Gemini APIキー</h3>
            <p>音声文字起こし・提案生成に使用します</p>
          </div>
        </div>

        <div className="settings-status">
          <div className={`status-badge ${hasKey ? 'status-active' : 'status-inactive'}`}>
            {loading ? '確認中...' : hasKey ? '設定済み' : '未設定'}
          </div>
          {updatedAt && (
            <span className="status-date">
              最終更新: {new Date(updatedAt).toLocaleString('ja-JP')}
            </span>
          )}
        </div>

        <div className="settings-form">
          <div className="input-group">
            <label htmlFor="apiKey">
              {hasKey ? '新しいAPIキーで上書き' : 'APIキーを入力'}
            </label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              className="settings-input"
              disabled={saving}
            />
          </div>

          <div className="settings-actions">
            <button
              onClick={handleSave}
              disabled={saving || !apiKey.trim()}
              className="btn-primary"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            {hasKey && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="btn-danger"
              >
                削除
              </button>
            )}
          </div>
        </div>

        {message && (
          <div className={`settings-message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="settings-help">
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
          <p className="settings-note">
            APIキーはAES-256-GCMで暗号化してサーバーに保存されます。
            環境変数にGEMINI_API_KEYが設定されている場合、そちらが優先されます。
          </p>
        </div>
      </div>

      {/* 開発者ツール（既存） */}
      <InstallView />

      <style jsx>{`
        .settings-view {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .settings-card {
          background: #1a1a2e;
          border: 1px solid #2a2a4a;
          border-radius: 12px;
          padding: 1.5rem;
        }
        .settings-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .settings-icon {
          font-size: 1.5rem;
        }
        .settings-header h3 {
          margin: 0;
          color: #e0e0e0;
        }
        .settings-header p {
          margin: 0.25rem 0 0;
          color: #888;
          font-size: 0.875rem;
        }
        .settings-status {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }
        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .status-active {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .status-inactive {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }
        .status-date {
          color: #666;
          font-size: 0.8rem;
        }
        .settings-form {
          margin-bottom: 1rem;
        }
        .input-group {
          margin-bottom: 0.75rem;
        }
        .input-group label {
          display: block;
          color: #aaa;
          font-size: 0.85rem;
          margin-bottom: 0.4rem;
        }
        .settings-input {
          width: 100%;
          padding: 0.6rem 0.8rem;
          background: #0d0d1a;
          border: 1px solid #3a3a5a;
          border-radius: 8px;
          color: #e0e0e0;
          font-size: 0.9rem;
          outline: none;
          box-sizing: border-box;
        }
        .settings-input:focus {
          border-color: #6366f1;
        }
        .settings-input:disabled {
          opacity: 0.5;
        }
        .settings-actions {
          display: flex;
          gap: 0.5rem;
        }
        .btn-primary {
          padding: 0.5rem 1.25rem;
          background: #6366f1;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 600;
        }
        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-primary:hover:not(:disabled) {
          background: #5558e6;
        }
        .btn-danger {
          padding: 0.5rem 1.25rem;
          background: transparent;
          color: #ef4444;
          border: 1px solid #ef4444;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.85rem;
        }
        .btn-danger:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-danger:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.1);
        }
        .settings-message {
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          font-size: 0.85rem;
          margin-bottom: 1rem;
        }
        .settings-message.success {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .settings-message.error {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .settings-help {
          border-top: 1px solid #2a2a4a;
          padding-top: 1rem;
          color: #888;
          font-size: 0.85rem;
        }
        .settings-help p {
          margin: 0 0 0.5rem;
        }
        .settings-help ol {
          margin: 0 0 0.75rem;
          padding-left: 1.25rem;
        }
        .settings-help li {
          margin-bottom: 0.25rem;
        }
        .settings-help a {
          color: #6366f1;
          text-decoration: none;
        }
        .settings-help a:hover {
          text-decoration: underline;
        }
        .settings-note {
          color: #666;
          font-size: 0.8rem;
          font-style: italic;
        }
      `}</style>
    </section>
  )
}
