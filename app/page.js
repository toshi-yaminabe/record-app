'use client'

import { useState } from 'react'
import { Header } from './components/header'
import { TabNavigation } from './components/tab-navigation'
import { ArchitectureView } from './features/architecture/architecture-view'
import { HistoryView } from './features/history/history-view'
import { InstallView } from './features/install/install-view'
import { TaskListView } from './features/tasks/task-list-view'
import { DailyCheckinView } from './features/daily/daily-checkin-view'
import { WeeklyReviewView } from './features/weekly/weekly-review-view'
import { BunjinManagerView } from './features/bunjins/bunjin-manager-view'
import { MemoryListView } from './features/memories/memory-list-view'
import { SwlsFormView } from './features/swls/swls-form-view'
import { SessionListView } from './features/sessions/session-list-view'

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('architecture')

  const tabs = [
    { id: 'architecture', label: 'アーキテクチャ', icon: '🔗' },
    { id: 'tasks', label: 'タスク', icon: '📝' },
    { id: 'daily', label: 'Daily', icon: '☀️' },
    { id: 'weekly', label: 'Weekly', icon: '📅' },
    { id: 'bunjins', label: '分人', icon: '👥' },
    { id: 'memories', label: '思い出', icon: '📖' },
    { id: 'swls', label: 'SWLS', icon: '💭' },
    { id: 'sessions', label: 'セッション', icon: '🎙️' },
    { id: 'history', label: '履歴', icon: '📝' },
    { id: 'settings', label: '開発者', icon: '📲' },
  ]

  const progress = 57

  return (
    <div className="dashboard">
      <Header progress={progress} />

      <section className="download-section">
        <div className="download-card">
          <div className="download-info">
            <div className="download-icon">📱</div>
            <div>
              <h2>Androidアプリをダウンロード</h2>
              <p>録音して文字起こしを始めましょう</p>
            </div>
          </div>
          <a
            href="https://github.com/toshi-yaminabe/record-app/releases/latest/download/app-release.apk"
            className="download-btn"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="download-btn-icon">⬇️</span>
            APKダウンロード
          </a>
        </div>
        <div className="download-help">
          <p>
            <strong>インストール方法:</strong> ダウンロード → ファイルを開く → 「提供元不明アプリ」を許可 → インストール
          </p>
          <a
            href="https://github.com/toshi-yaminabe/record-app/releases"
            className="releases-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            全てのリリースを見る →
          </a>
        </div>
      </section>

      <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'architecture' && <ArchitectureView />}
      {activeTab === 'tasks' && <TaskListView />}
      {activeTab === 'daily' && <DailyCheckinView />}
      {activeTab === 'weekly' && <WeeklyReviewView />}
      {activeTab === 'bunjins' && <BunjinManagerView />}
      {activeTab === 'memories' && <MemoryListView />}
      {activeTab === 'swls' && <SwlsFormView />}
      {activeTab === 'sessions' && <SessionListView />}
      {activeTab === 'history' && <HistoryView />}
      {activeTab === 'settings' && <InstallView />}

      <footer className="footer">
        <p>Record App Dashboard • Built with Next.js + Gemini AI</p>
      </footer>
    </div>
  )
}
