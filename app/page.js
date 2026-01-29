'use client'

import { useState, useEffect } from 'react'

// アーキテクチャノードデータ
const architectureNodes = [
  {
    id: 'flutter',
    name: 'Flutter App',
    icon: '📱',
    color: '#02569B',
    status: 'completed',
    x: 0,
    files: [
      { name: 'main.dart', status: 'done' },
      { name: 'recording_page.dart', status: 'done' },
      { name: 'audio_provider.dart', status: 'done' },
      { name: 'transcribe_repository.dart', status: 'done' },
    ],
    features: ['10分セグメント録音', 'Riverpod状態管理', '録音UI'],
  },
  {
    id: 'api',
    name: 'Next.js API',
    icon: '⚡',
    color: '#000000',
    status: 'completed',
    x: 1,
    files: [
      { name: 'route.js', status: 'done' },
      { name: 'prisma.js', status: 'done' },
      { name: 'gemini.js', status: 'done' },
    ],
    features: ['POST /api/transcribe', 'GET 履歴取得'],
  },
  {
    id: 'gemini',
    name: 'Gemini Flash',
    icon: '🤖',
    color: '#4285F4',
    status: 'completed',
    x: 2,
    files: [],
    features: ['音声→テキスト変換', 'マルチモーダルAI'],
  },
  {
    id: 'database',
    name: 'Neon DB',
    icon: '💾',
    color: '#00E599',
    status: 'completed',
    x: 3,
    files: [
      { name: 'schema.prisma', status: 'done' },
    ],
    features: ['PostgreSQL', 'サーバーレス', 'Prisma ORM'],
  },
]

// Phase 3 の追加ノード
const futureNodes = [
  {
    id: 'background',
    name: 'Background Service',
    icon: '🔄',
    color: '#9E9E9E',
    status: 'pending',
    files: [],
    features: ['バックグラウンド録音', 'Foreground Service'],
  },
  {
    id: 'offline',
    name: 'Offline Queue',
    icon: '📴',
    color: '#9E9E9E',
    status: 'pending',
    files: [],
    features: ['オフライン保存', 'リトライ機構', '通知'],
  },
]

// 接続線データ
const connections = [
  { from: 'flutter', to: 'api', label: 'HTTP POST' },
  { from: 'api', to: 'gemini', label: 'API Call' },
  { from: 'api', to: 'database', label: 'Prisma' },
]

// ノードコンポーネント
function ArchitectureNode({ node, isExpanded, onToggle }) {
  const isCompleted = node.status === 'completed'

  return (
    <div
      className={`arch-node ${isCompleted ? 'completed' : 'pending'}`}
      style={{ '--node-color': node.color }}
      onClick={onToggle}
    >
      <div className="node-header">
        <div className="node-icon">{node.icon}</div>
        <div className="node-info">
          <h3>{node.name}</h3>
          <span className={`node-status ${node.status}`}>
            {isCompleted ? '✓ 完了' : '○ 未実装'}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="node-details">
          {node.features.length > 0 && (
            <div className="node-features">
              {node.features.map((f, i) => (
                <span key={i} className="feature-tag">{f}</span>
              ))}
            </div>
          )}

          {node.files.length > 0 && (
            <div className="node-files">
              {node.files.map((f, i) => (
                <div key={i} className="file-item">
                  <span className="file-icon">📄</span>
                  <span>{f.name}</span>
                  {f.status === 'done' && <span className="file-check">✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// メインダッシュボード
export default function Dashboard() {
  const [transcripts, setTranscripts] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedNodes, setExpandedNodes] = useState(['flutter', 'api'])
  const [activeTab, setActiveTab] = useState('architecture')

  useEffect(() => {
    fetchTranscripts()
  }, [])

  async function fetchTranscripts() {
    try {
      const res = await fetch('/api/transcribe')
      const data = await res.json()
      if (data.transcripts) {
        setTranscripts(data.transcripts.slice(0, 10))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const toggleNode = (id) => {
    setExpandedNodes(prev =>
      prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]
    )
  }

  const completedCount = architectureNodes.filter(n => n.status === 'completed').length
  const totalCount = architectureNodes.length + futureNodes.length
  const progress = Math.round((completedCount / totalCount) * 100)

  return (
    <div className="dashboard">
      {/* ヘッダー */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🎙️</span>
            <h1>Record App</h1>
          </div>
          <div className="progress-badge">
            <div className="progress-ring">
              <svg viewBox="0 0 36 36">
                <path
                  className="progress-bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="progress-fill"
                  strokeDasharray={`${progress}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="progress-text">{progress}%</span>
            </div>
            <span className="progress-label">開発進捗</span>
          </div>
        </div>
        <p className="tagline">音声録音 → AI文字起こし → クラウド保存</p>
      </header>

      {/* タブナビゲーション */}
      <nav className="tabs">
        <button
          className={`tab ${activeTab === 'architecture' ? 'active' : ''}`}
          onClick={() => setActiveTab('architecture')}
        >
          🔗 アーキテクチャ
        </button>
        <button
          className={`tab ${activeTab === 'install' ? 'active' : ''}`}
          onClick={() => setActiveTab('install')}
        >
          📲 インストール
        </button>
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📝 履歴 {transcripts.length > 0 && <span className="badge">{transcripts.length}</span>}
        </button>
      </nav>

      {/* アーキテクチャビュー */}
      {activeTab === 'architecture' && (
        <section className="architecture-view">
          {/* メインフロー */}
          <div className="flow-section">
            <h2>
              <span className="section-icon">⚡</span>
              メインデータフロー
              <span className="section-badge completed">Phase 1-2 完了</span>
            </h2>

            <div className="flow-container">
              <div className="flow-nodes">
                {architectureNodes.map((node, index) => (
                  <div key={node.id} className="flow-node-wrapper">
                    <ArchitectureNode
                      node={node}
                      isExpanded={expandedNodes.includes(node.id)}
                      onToggle={() => toggleNode(node.id)}
                    />
                    {index < architectureNodes.length - 1 && (
                      <div className="flow-connector">
                        <div className="connector-line"></div>
                        <span className="connector-label">{connections[index]?.label}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Phase 3 */}
          <div className="flow-section future">
            <h2>
              <span className="section-icon">🚀</span>
              Phase 3: 拡張機能
              <span className="section-badge pending">未実装</span>
            </h2>

            <div className="future-nodes">
              {futureNodes.map(node => (
                <ArchitectureNode
                  key={node.id}
                  node={node}
                  isExpanded={expandedNodes.includes(node.id)}
                  onToggle={() => toggleNode(node.id)}
                />
              ))}
            </div>
          </div>

          {/* ファイル構成サマリー */}
          <div className="file-summary">
            <h2>
              <span className="section-icon">📁</span>
              プロジェクト構成
            </h2>
            <div className="file-grid">
              <div className="file-card">
                <div className="file-card-header">
                  <span>📱</span>
                  <h3>flutter_app/</h3>
                </div>
                <div className="file-tree">
                  <code>
{`lib/
├── main.dart
├── presentation/
│   ├── pages/
│   │   └── recording_page.dart
│   └── providers/
│       └── audio_provider.dart
└── data/
    └── repositories/
        └── transcribe_repository.dart`}
                  </code>
                </div>
              </div>

              <div className="file-card">
                <div className="file-card-header">
                  <span>⚡</span>
                  <h3>record-app/</h3>
                </div>
                <div className="file-tree">
                  <code>
{`app/
├── page.js          (ダッシュボード)
├── layout.js
├── globals.css
└── api/transcribe/
    └── route.js     (POST/GET)
lib/
├── prisma.js        (DB接続)
└── gemini.js        (AI API)
prisma/
└── schema.prisma    (DBスキーマ)`}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* インストールビュー */}
      {activeTab === 'install' && (
        <section className="install-view">
          <div className="install-card">
            <div className="install-header">
              <span className="install-icon">🔧</span>
              <div>
                <h3>開発モード（USB）</h3>
                <p>リアルタイムでデバッグ可能</p>
              </div>
            </div>
            <div className="install-steps">
              <div className="step">
                <span className="step-num">1</span>
                <span>Android「開発者向けオプション」→「USBデバッグ」ON</span>
              </div>
              <div className="step">
                <span className="step-num">2</span>
                <span>PCとUSB接続</span>
              </div>
              <div className="step">
                <span className="step-num">3</span>
                <span>コマンド実行</span>
              </div>
            </div>
            <pre className="code-block">
{`cd flutter_app
flutter devices    # デバイス確認
flutter run        # アプリ起動`}
            </pre>
          </div>

          <div className="install-card">
            <div className="install-header">
              <span className="install-icon">📦</span>
              <div>
                <h3>APKビルド</h3>
                <p>インストールファイル作成</p>
              </div>
            </div>
            <pre className="code-block">
{`cd flutter_app
flutter build apk --release

# 出力: build/app/outputs/flutter-apk/app-release.apk`}
            </pre>
            <p className="install-note">→ APKをスマホに転送してインストール</p>
          </div>

          <div className="install-card">
            <div className="install-header">
              <span className="install-icon">☁️</span>
              <div>
                <h3>Vercelデプロイ</h3>
                <p>Webサーバー公開</p>
              </div>
            </div>
            <pre className="code-block">
{`cd record-app
npm run build      # ビルド確認
vercel --prod      # 本番デプロイ`}
            </pre>
            <p className="install-note">→ 環境変数: DATABASE_URL, GEMINI_API_KEY</p>
          </div>
        </section>
      )}

      {/* 履歴ビュー */}
      {activeTab === 'history' && (
        <section className="history-view">
          <div className="history-header">
            <h2>文字起こし履歴</h2>
            <button className="refresh-btn" onClick={fetchTranscripts}>
              🔄 更新
            </button>
          </div>

          {loading && <div className="loading-state">読み込み中...</div>}

          {!loading && transcripts.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">📭</span>
              <p>まだ文字起こしデータがありません</p>
              <p className="empty-hint">Flutterアプリで録音→送信してください</p>
            </div>
          )}

          {transcripts.length > 0 && (
            <div className="transcript-list">
              {transcripts.map((t, i) => (
                <div key={t.id || i} className="transcript-card">
                  <div className="transcript-header">
                    <span className="transcript-id">#{t.segmentNo}</span>
                    <span className="transcript-session">{t.sessionId?.slice(0, 8)}</span>
                    <span className="transcript-date">
                      {new Date(t.createdAt).toLocaleString('ja-JP')}
                    </span>
                  </div>
                  <p className="transcript-text">
                    {t.text?.slice(0, 200)}{t.text?.length > 200 ? '...' : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <footer className="footer">
        <p>Record App Dashboard • Built with Next.js + Gemini AI</p>
      </footer>
    </div>
  )
}
