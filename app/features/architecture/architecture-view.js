'use client'

import { useState } from 'react'

const architectureNodes = [
  {
    id: 'flutter',
    name: 'Flutter App',
    icon: '📱',
    color: '#02569B',
    status: 'completed',
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
    files: [],
    features: ['音声→テキスト変換', 'マルチモーダルAI'],
  },
  {
    id: 'database',
    name: 'Neon DB',
    icon: '💾',
    color: '#00E599',
    status: 'completed',
    files: [{ name: 'schema.prisma', status: 'done' }],
    features: ['PostgreSQL', 'サーバーレス', 'Prisma ORM'],
  },
]

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

const connections = [
  { from: 'flutter', to: 'api', label: 'HTTP POST' },
  { from: 'api', to: 'gemini', label: 'API Call' },
  { from: 'api', to: 'database', label: 'Prisma' },
]

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

export function ArchitectureView() {
  const [expandedNodes, setExpandedNodes] = useState(['flutter', 'api'])

  const toggleNode = (id) => {
    setExpandedNodes(prev =>
      prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]
    )
  }

  return (
    <section className="architecture-view">
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
  )
}
