# record-app v1.5.1 実機テスト手順書

## 0. 事前準備

### APKインストール
1. GitHub Release v1.5.1 から APK をダウンロード
2. Androidスマホで「提供元不明のアプリ」のインストールを許可
3. APKをインストール

### ログ監視の開始
PCにスマホをUSB接続し、以下のコマンドでログ監視を開始:

```bash
adb logcat -s flutter | grep "record-app"
```

### 起動確認
アプリを起動し、以下のログが出力されることを確認:
```
[LIFE] app starting: deviceId=<UUID>
[LIFE] recordingsDir=<path>
[LIFE] baseUrl=https://record-app-one.vercel.app
```

- [ ] `deviceId` が UUID 形式であること
- [ ] `baseUrl` が正しい URL であること（`(empty)` でないこと）

---

## 1. 録音基本テスト

| # | 操作 | 期待ログ / 期待動作 | Pass | Fail | 備考 |
|---|------|---------------------|------|------|------|
| 1-1 | 録音開始ボタンをタップ | `[REC] startRecording: waiting for ready handshake` | | | |
| 1-2 | (自動) ready受信 | `[REC] ready received, sending start command sessionId=<UUID>` | | | |
| 1-3 | 10秒間録音 → 停止ボタンタップ | `[REC-BG] segment completed path=<path> segmentNo=1` | | | |
| 1-4 | (自動) 停止完了 | `[REC-BG] stopRecording sessionId=<UUID>` | | | |
| 1-5 | (自動) 文字起こし送信 | `[API] POST /api/transcribe -> 200` | | | |
| 1-6 | 録音パネルに文字起こし結果が表示 | 画面に文字が表示される | | | |

---

## 2. バックグラウンド録音テスト

| # | 操作 | 期待ログ / 期待動作 | Pass | Fail | 備考 |
|---|------|---------------------|------|------|------|
| 2-1 | 録音開始 → ホームボタンで退避 | `[REC] BG event: onRecordingStarted` | | | |
| 2-2 | 3分間バックグラウンドで待機 | (ログは蓄積される) | | | |
| 2-3 | アプリ復帰 | `[REC] syncBackgroundState: isRecording=true` | | | |
| 2-4 | 停止 → セグメント完了 | `[REC-BG] segment completed` + `[REC-BG] stopRecording` | | | |

---

## 3. 文字起こし失敗リトライテスト

| # | 操作 | 期待ログ / 期待動作 | Pass | Fail | 備考 |
|---|------|---------------------|------|------|------|
| 3-1 | 機内モードON | (接続なし) | | | |
| 3-2 | 録音開始 → 10秒 → 停止 | `[REC] transcribe failed, enqueueing retry` | | | |
| 3-3 | 機内モードOFF | `[QUEUE] flush triggered by connectivity restore` | | | |
| 3-4 | (自動) リトライ成功 | `[API] POST /api/transcribe -> 200` | | | |

---

## 4. セッション管理テスト

| # | 操作 | 期待ログ / 期待動作 | Pass | Fail | 備考 |
|---|------|---------------------|------|------|------|
| 4-1 | 録音開始時のセッション作成 | `[API] POST /api/sessions -> 201` | | | |
| 4-2 | セッション一覧取得 | `[API] GET /api/sessions -> 200` | | | |

---

## 5. タスク管理テスト

| # | 操作 | 期待ログ / 期待動作 | Pass | Fail | 備考 |
|---|------|---------------------|------|------|------|
| 5-1 | タスク一覧取得 | `[API] GET /api/tasks -> 200` + 画面表示 | | | |
| 5-2 | タスク作成 | `[API] POST /api/tasks -> 201` + 一覧に追加 | | | |
| 5-3 | タスクステータス変更 | `[API] PATCH /api/tasks/:id -> 200` | | | |

---

## 6. 文人(Bunjin)管理テスト

| # | 操作 | 期待ログ / 期待動作 | Pass | Fail | 備考 |
|---|------|---------------------|------|------|------|
| 6-1 | 文人一覧取得 | `[API] GET /api/bunjins -> 200` | | | |
| 6-2 | 文人作成 | `[API] POST /api/bunjins -> 201` | | | |

---

## 7. 提案(Proposal)テスト

| # | 操作 | 期待ログ / 期待動作 | Pass | Fail | 備考 |
|---|------|---------------------|------|------|------|
| 7-1 | 提案一覧取得 | `[API] GET /api/proposals -> 200` | | | |
| 7-2 | 提案生成 | `[API] POST /api/proposals -> 200` | | | |
| 7-3 | 承認/却下 | `[API] PATCH /api/proposals/:id -> 200` | | | |

---

## 8. デイリーチェックインテスト

| # | 操作 | 期待ログ / 期待動作 | Pass | Fail | 備考 |
|---|------|---------------------|------|------|------|
| 8-1 | チェックインページ表示 | データ読み込み確認 | | | |
| 8-2 | SWLS入力 → 送信 | 成功ログ確認 | | | |

---

## 9. 設定ページテスト

| # | 操作 | 期待ログ / 期待動作 | Pass | Fail | 備考 |
|---|------|---------------------|------|------|------|
| 9-1 | 設定ページ表示 | API接続先 = `https://record-app-one.vercel.app` | | | |
| 9-2 | バージョン確認 | `1.5.1+3` と表示 | | | |
| 9-3 | オフラインキュー件数表示 | 件数が正しいこと | | | |
| 9-4 | 全クリア → 件数0 | SnackBar + 件数が0 | | | |
| 9-5 | デバッグログ表示 | ログ画面が開き、ログ内容が表示される | | | |
| 9-6 | ログクリア | SnackBar表示、再度開くとログがリセット | | | |

---

## 10. エラーケーステスト

| # | 操作 | 期待ログ / 期待動作 | Pass | Fail | 備考 |
|---|------|---------------------|------|------|------|
| 10-1 | バックエンド停止中にAPI操作 | SnackBar/エラー表示、クラッシュしない | | | |
| 10-2 | 機内モードで全操作 | クラッシュしないことを確認 | | | |
| 10-3 | エラー時のログ | スタックトレースが出力されること | | | |

---

## テスト結果の取得とClaude検証

### ログファイルの取得

テスト完了後:

```bash
# 1. PCにスマホをUSB接続
# 2. ログファイルをPCにコピー
adb pull /data/data/com.example.flutter_app/app_flutter/debug.log ~/apps/record-app/test-results/debug.log
```

### アプリ内でのログ確認

PC接続なしでもスマホ上で確認可能:
1. 設定ページ → 「ログ表示」ボタン
2. ログ内容がスクロール表示される
3. 「ログクリア」でリセット

### Claude検証フロー

```
ユーザー: 「テスト終わった、ログ確認して」
    ↓
Claude: debug.log を読んで以下を自動検証:
  - 起動ログ (deviceId, baseUrl が正しい値か)
  - API通信ログ (全エンドポイントが 200/201 を返しているか)
  - 録音ログ (ready handshake成功, segment完了, 停止)
  - 文字起こしログ (送信成功 or リトライキュー投入)
  - エラーログ (予期しないエラーがないか)
  - オフラインキューログ (flush成功)
    ↓
Claude: 検証レポートを出力 (Pass / Fail / 要調査)
```

---

## 変更サマリ (v1.5.0+2 -> v1.5.1+3)

### SHOWSTOPPER修正
- **S1**: 全APIレスポンスのエンベロープ展開 (`json['session']`, `json['tasks']` 等)
- **S2**: オフラインキューの文字起こしリトライを `PendingTranscribeStore` + `TranscribeRetryService` で再設計（multipart直接再送）

### CRITICAL修正
- **C1**: TranscribeService に60秒タイムアウト追加
- **C2**: セッションステータス `COMPLETED` -> `STOPPED` に修正

### HIGH修正
- **H1**: ConnectivityMonitor の flush() を await + try-catch で保護
- **H2**: deviceId が `'loading'` の場合に録音をブロック
- **H3**: main.dart の OfflineQueueService を Provider経由に統一
- **H4**: QueueEntry ステータスコメントを実態に合わせて修正

### 新機能
- **AppLogger**: カテゴリ別ロガー (API/DB/REC/QUEUE/LIFE) + ファイル出力
- **デバッグログUI**: 設定ページにログ表示/クリアボタン追加
