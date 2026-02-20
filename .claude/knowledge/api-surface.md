---
tags: [api, endpoints, environment, external-services]
keywords: [エンドポイント, 環境変数, Gemini, Neon, Vercel, STT, 文字起こし, 提案, transcribe, proposals, sessions]
last_updated: 2026-02-15
---
# API仕様・環境変数・外部依存

20 APIエンドポイント (REST)。全て MOCK_USER_ID 認証（Cron除く）。

## エンドポイント一覧

### ヘルスチェック

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/health` | システム状態確認 (DB + Gemini) | 不要 |

### 文字起こし

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| POST | `/api/transcribe` | 音声→文字起こし (multipart, max 6MB, 60s) | MOCK_USER_ID |
| GET | `/api/transcribe` | 履歴取得 | MOCK_USER_ID |

POST: `audio` (File) + `deviceId` + `sessionId` + `segmentNo?` + `startAt?` + `endAt?`
副作用: Transcript + Session (auto-create) + Segment を同時作成

### セッション

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| POST | `/api/sessions` | セッション作成 (PublishedVersion自動紐付け) | MOCK_USER_ID |
| GET | `/api/sessions` | 一覧取得 (limit 1-200, default 50) | MOCK_USER_ID |
| GET | `/api/sessions/:id` | 詳細 (segments + ruleVersion含む) | MOCK_USER_ID |
| PATCH | `/api/sessions/:id` | 停止 (STOPPED, endedAt設定) | MOCK_USER_ID |

### セグメント

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/segments` | 一覧取得 (sessionId? filter) | MOCK_USER_ID |
| GET | `/api/segments/:id` | 詳細取得 | MOCK_USER_ID |
| PATCH | `/api/segments/:id` | STTステータス/テキスト更新 | MOCK_USER_ID |

### 分人 (Bunjin)

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/bunjins` | 全分人取得 | MOCK_USER_ID |
| POST | `/api/bunjins` | カスタム分人作成 (最大3つ) | MOCK_USER_ID |
| PATCH | `/api/bunjins/:id` | 分人更新 | MOCK_USER_ID |
| DELETE | `/api/bunjins/:id` | カスタム分人削除 | MOCK_USER_ID |

### タスク

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/tasks` | 一覧 (status? / bunjinId? filter) | MOCK_USER_ID |
| POST | `/api/tasks` | タスク作成 | MOCK_USER_ID |
| PATCH | `/api/tasks/:id` | ステータス更新 (状態遷移マトリクス検証) | MOCK_USER_ID |

### 提案 (Proposal)

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/proposals` | 一覧取得 | MOCK_USER_ID |
| POST | `/api/proposals` | 日次提案生成 (Gemini, 60s) | MOCK_USER_ID |
| PATCH | `/api/proposals/:id` | 確定/却下 (CONFIRMED→Task自動作成) | MOCK_USER_ID |

### ルールツリー

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/rule-trees` | ツリー取得 (初回自動生成) | MOCK_USER_ID |
| PUT | `/api/rule-trees` | ドラフト全置換 | MOCK_USER_ID |
| POST | `/api/rule-trees/publish` | 検証・公開 (サイクル検出, 深度10) | MOCK_USER_ID |

### SWLS

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/swls` | 回答取得 (dateKey?, default今日) | MOCK_USER_ID |
| POST | `/api/swls` | 回答作成/更新 (upsert) | MOCK_USER_ID |

### メモリー

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/memories` | 一覧取得 | MOCK_USER_ID |
| POST | `/api/memories` | 作成 (append-only) | MOCK_USER_ID |
| PATCH | `/api/memories/:id` | テキスト更新 | MOCK_USER_ID |

### 週次レビュー

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/weekly-review` | 実行記録取得 (weekKey必須) | MOCK_USER_ID |
| POST | `/api/weekly-review` | 実行記録作成 | MOCK_USER_ID |

### ユーザー設定

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/settings` | 設定取得 (APIキー有無のみ) | MOCK_USER_ID |
| PUT | `/api/settings` | APIキー保存 (AES-256-GCM暗号化) | MOCK_USER_ID |
| DELETE | `/api/settings` | APIキー削除 | MOCK_USER_ID |

### Cron

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/cron/archive-tasks` | 14日以上更新なしタスク自動アーカイブ | CRON_SECRET |

## レスポンスエンベロープ

エラー形式統一: `{ "error": "エラーメッセージ" }`

| コード | 意味 | 発生条件 |
|--------|------|---------|
| 200 | 成功 | 正常レスポンス |
| 201 | 作成成功 | POST成功時 |
| 400 | バリデーションエラー | 必須フィールド不足、不正値 |
| 404 | 未検出 | リソースなし |
| 409 | 競合 | ユニーク制約違反、上限超過 |
| 413 | ペイロード過大 | 音声 > 6MB |
| 500 | サーバーエラー | 未知のエラー |
| 503 | サービス利用不可 | DATABASE_URL未設定 |

## 環境変数

### バックエンド (Next.js / Vercel)

| 変数名 | 用途 | 必須 |
|--------|------|------|
| `DATABASE_URL` | Neon PostgreSQL接続文字列 (`postgresql://...?sslmode=require`) | 必須 |
| `GEMINI_API_KEY` | Gemini API (STT + 提案生成) | 必須 (※DB保存でも代替可) |
| `ENCRYPTION_KEY` | AES-256-GCM暗号化キー (32byte hex=64文字) | 任意 (未設定時DATABASE_URLハッシュ) |
| `CRON_SECRET` | Cronジョブ認証トークン | 任意 |

**Gemini APIキーの優先順位:**
1. 環境変数 `GEMINI_API_KEY`（最優先）
2. DB保存キー (`user_settings.gemini_api_key`, 復号して使用)
3. どちらもなければ `null` → STTと提案生成が無効

### Flutter

| 変数名 | 用途 | 設定方法 |
|--------|------|---------|
| `API_BASE_URL` | バックエンドAPIベースURL | `--dart-define=API_BASE_URL=https://...` |

## 外部サービス依存

### Vercel

| 項目 | 詳細 |
|------|------|
| 用途 | Next.jsホスティング、サーバーレス関数、Cronジョブ |
| 関数タイムアウト | transcribe: 60s, proposals: 60s, 他: デフォルト |
| 設定 | `vercel.json` |

### Neon (PostgreSQL)

| 項目 | 詳細 |
|------|------|
| 用途 | プライマリデータベース |
| アダプタ | `@prisma/adapter-neon` (v6.2.1) |
| 接続 | Neon Serverless WebSocket + PrismaNeon adapter |
| SSL | 必須 (`sslmode=require`) |

### Google Gemini API

| 項目 | 詳細 |
|------|------|
| 用途 | 音声文字起こし (STT) + 提案テキスト生成 |
| モデル | `gemini-2.0-flash` (安定版) |
| SDK | `@google/generative-ai` v0.24.x |
| STT入力 | base64エンコード音声 + テキストプロンプト |
| 提案入力 | テキストプロンプト (セグメントテキスト結合) |
| STT出力 | 日本語テキスト |
| 提案出力 | JSON配列 `[{type, title, body}]` |

### GitHub Releases

| 項目 | 詳細 |
|------|------|
| 用途 | Flutter APK配布 |
| URL | `https://github.com/toshi-yaminabe/record-app/releases` |

## 関連ナレッジ

- 参照: `overview.md` — プロジェクト概要・アーキテクチャ
- 参照: `data-model.md` — DB設計詳細（14モデル、ER図、状態遷移）
