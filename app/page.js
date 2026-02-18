'use client'

import { useState } from 'react'
import { Header } from './components/header'
import { TabNavigation } from './components/tab-navigation'
import { HistoryView } from './features/history/history-view'
import { SettingsView } from './features/settings/settings-view'
import { TaskListView } from './features/tasks/task-list-view'
import { DailyCheckinView } from './features/daily/daily-checkin-view'
import { BunjinManagerView } from './features/bunjins/bunjin-manager-view'
import { WeeklyReviewView } from './features/weekly/weekly-review-view'
import { MemoryListView } from './features/memories/memory-list-view'

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('daily')

  const tabs = [
    { id: 'daily', label: 'Daily', icon: '☀️' },
    { id: 'tasks', label: 'タスク', icon: '📝' },
    { id: 'bunjins', label: '分人', icon: '👥' },
    { id: 'weekly', label: '週次', icon: '📅' },
    { id: 'memories', label: 'メモリー', icon: '📖' },
    { id: 'history', label: '履歴', icon: '🕐' },
    { id: 'settings', label: '設定', icon: '⚙️' },
  ]

  return (
    <div className="dashboard">
      <Header />

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

      {activeTab === 'daily' && <DailyCheckinView />}
      {activeTab === 'tasks' && <TaskListView />}
      {activeTab === 'bunjins' && <BunjinManagerView />}
      {activeTab === 'weekly' && <WeeklyReviewView />}
      {activeTab === 'memories' && <MemoryListView />}
      {activeTab === 'history' && <HistoryView />}
      {activeTab === 'settings' && <SettingsView />}

      <footer className="footer">
        <p>Record App Dashboard • Built with Next.js + Gemini AI</p>
      </footer>
    </div>
  )
}
