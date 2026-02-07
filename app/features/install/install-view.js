'use client'

export function InstallView() {
  return (
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
  )
}
