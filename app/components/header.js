'use client'

export function Header({ progress = 0 }) {
  return (
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
  )
}
