# record-app ナレッジ資料

**最終更新:** 2026-02-19
**バージョン:** Web v2.0.0-beta.12 (package.json) / Flutter v2.0.0-beta.12+13 (pubspec.yaml)

---

## 目次

1. [アーキテクチャ全体像](#1-アーキテクチャ全体像)
2. [データベース設計](#2-データベース設計)
3. [API一覧](#3-api一覧)
4. [環境変数](#4-環境変数)
5. [機能接続関係図](#5-機能接続関係図)
6. [外部サービス依存](#6-外部サービス依存)
7. [現在の問題点](#7-現在の問題点)
8. [セットアップ手順](#8-セットアップ手順)
9. [UX体験定義と技術的負債マトリクス](#9-ux体験定義と技術的負債マトリクス)

---

## 1. アーキテクチャ全体像

### システム構成図

```mermaid
graph TB
    subgraph Client["クライアント層"]
        Flutter["Flutter App<br/>(Android)"]
        Web["Next.js Web Dashboard<br/>(React 19)"]
    end

    subgraph Server["サーバー層 (Vercel)"]
        API["Next.js 15 API Routes<br/>(app/api/)"]
        Services["Service Layer<br/>(lib/services/)"]
        Lib["共通ライブラリ<br/>(lib/)"]
    end

    subgraph External["外部サービス"]
        Supabase["Supabase PostgreSQL<br/>(ap-northeast-1)"]
        Gemini["Google Gemini API<br/>(gemini-2.0-flash)"]
    end

    Flutter -->|REST API| API
    Web -->|直接呼び出し| API
    API --> Services
    Services --> Lib
    Lib -->|Prisma 6| Supabase
    Lib -->|@google/generative-ai| Gemini
```

### ディレクトリ構造

```
record-app/
├── app/                          # Next.js App Router
│   ├── api/                      # APIルート (20エンドポイント)
│   │   ├── bunjins/              # 分人CRUD
│   │   ├── cron/archive-tasks/   # タスク自動アーカイブ
│   │   ├── health/               # ヘルスチェック
│   │   ├── memories/             # メモリーCRUD
│   │   ├── proposals/            # 提案生成・確定・却下
│   │   ├── rule-trees/           # ルールツリー編集・公開
│   │   ├── segments/             # セグメント一覧・更新
│   │   ├── sessions/             # セッション管理
│   │   ├── settings/             # ユーザー設定 (Gemini APIキーのDB保存)
│   │   ├── swls/                 # SWLS回答管理
│   │   ├── tasks/                # タスクCRUD
│   │   ├── transcribe/           # 音声文字起こし
│   │   └── weekly-review/        # 週次レビュー
│   ├── components/               # 共通UIコンポーネント
│   ├── features/                 # 機能別ビュー
│   ├── hooks/                    # React hooks
│   ├── page.js                   # ダッシュボード (SPA)
│   ├── layout.js                 # ルートレイアウト
│   └── error.js                  # エラーバウンダリ
├── lib/                          # バックエンド共通ライブラリ
│   ├── prisma.js                 # Prismaクライアント初期化 (Supabase PostgreSQL via PgBouncer)
│   ├── gemini.js                 # Gemini API (STT + 提案生成, 環境変数 > DB保存キー)
│   ├── crypto.js                 # AES-256-GCM暗号化 (APIキーのDB保存用)
│   ├── constants.js              # 定数定義 (MOCK_USER_ID, ステータス, デフォルト分人, BUNJIN_LIMITS, GEMINI_API_TIMEOUT_MS)
│   ├── errors.js                 # カスタムエラークラス (AppError, errorResponse)
│   ├── validators.js             # バリデーション (タスク状態遷移・STT状態遷移・ルールツリー・日付検証)
│   └── services/                 # ビジネスロジック層 (10サービス)
│       ├── bunjin-service.js
│       ├── memory-service.js
│       ├── proposal-service.js
│       ├── rule-tree-service.js
│       ├── segment-service.js
│       ├── session-service.js
│       ├── swls-service.js
│       ├── task-service.js
│       ├── transcribe-service.js  # 文字起こしビジネスロジック (route.jsから抽出)
│       └── weekly-service.js
├── prisma/
│   ├── schema.prisma             # DBスキーマ (14モデル)
│   ├── seed.mjs                  # 初期データ投入 (ESM)
│   └── migrations/               # Prismaマイグレーション
├── flutter_app/                  # Flutterモバイルアプリ
│   └── lib/
│       ├── main.dart             # アプリエントリポイント
│       ├── core/                 # 定数(BUNJIN_LIMITS追加)・ロガー・エラー
│       ├── data/                 # モデル(bunjin_summary.dart追加)・リポジトリ・ローカルDB
│       │   └── local/            # SQLite統合DB (unified_queue.db, SQLCipher暗号化)
│       │       ├── base_queue_db.dart          # 共通CRUDテンプレート
│       │       ├── unified_queue_database.dart # シングルトンDB管理
│       │       ├── migration_helper.dart       # 旧DB→統合DB + 平文→暗号化移行
│       │       ├── secure_db_key_manager.dart  # SQLCipherパスフレーズ管理
│       │       └── offline_queue_db.dart       # 汎用APIキュー (BaseQueueDB継承)
│       ├── presentation/         # UI (pages/providers/widgets)
│       └── services/             # 録音・文字起こし・オフライン
├── next.config.mjs               # Next.js設定 (ESM, bodySizeLimit: 10mb, セキュリティヘッダー6種)
├── vercel.json                   # Vercel関数設定 (transcribe/proposals: 60s)
└── package.json                  # v2.0.0-beta.12
```

### 技術スタック

| 領域 | 技術 | バージョン |
|------|------|-----------|
| Web Framework | Next.js (App Router) | 15.x |
| React | React 19 | 19.x |
| ORM | Prisma | 6.2.x |
| Database | PostgreSQL (Supabase) | 17.x |
| AI/ML | Google Generative AI (Gemini 2.0 Flash) | 0.24.x |
| Flutter | Flutter SDK | >=3.10.0 |
| 状態管理 | Riverpod | 2.6.x |
| 録音 | record パッケージ | 5.2.x |
| バックグラウンド | flutter_background_service | 5.0.x |
| ローカルDB | sqflite_sqlcipher (SQLCipher暗号化) | 3.1.x |
| セキュアストレージ | flutter_secure_storage | 9.2.x |
| ホスティング | Vercel | - |

---

## 2. データベース設計

### ER図

```mermaid
erDiagram
    Bunjin ||--o{ Segment : "has"
    Bunjin ||--o{ Task : "has"
    Bunjin ||--o{ Memory : "has"
    RuleTree ||--o{ RuleTreeNode : "contains"
    RuleTree ||--o{ PublishedVersion : "versions"
    RuleTreeNode ||--o{ RuleTreeNode : "parent-child"
    PublishedVersion ||--o{ Session : "used_by"
    Session ||--o{ Segment : "contains"
    Segment ||--o| AudioDeletionLog : "deletion"
    Proposal ||--o{ WeeklyExecution : "executed_in"

    Bunjin {
        string id PK
        string userId
        string slug UK
        string displayName
        string description
        string color
        string icon
        boolean isDefault
    }

    Session {
        string id PK
        string userId
        string deviceId
        string status "ACTIVE|STOPPED"
        string ruleVersionId FK
        datetime startedAt
        datetime endedAt
    }

    Segment {
        string id PK
        string sessionId FK
        string userId
        int segmentNo
        datetime startAt
        datetime endAt
        string text "nullable"
        string sttStatus "PENDING|PROCESSING|DONE|FAILED"
        int sttAttemptCount
        string bunjinId FK
    }

    Task {
        string id PK
        string userId
        string bunjinId FK
        string title
        string body
        string status "TODO|DOING|DONE|ARCHIVED"
        int priority
        datetime archivedAt
    }

    Proposal {
        string id PK
        string userId
        string dateKey "YYYY-MM-DD"
        string type "SUMMARY|TASK"
        string title
        string body
        string status "PENDING|CONFIRMED|REJECTED"
    }

    RuleTree {
        string id PK
        string userId
        string name
    }

    RuleTreeNode {
        string id PK
        string ruleTreeId FK
        string parentId FK "nullable, self-ref"
        string type "condition|bunjin"
        string label
        string condition
        string bunjinSlug
        int sortOrder
    }

    PublishedVersion {
        string id PK
        string ruleTreeId FK
        int version
        string treeJson "JSONスナップショット"
    }

    SwlsResponse {
        string id PK
        string userId
        string dateKey UK "YYYY-MM-DD"
        string q1
        string q2
        string q3
        string q4
        string q5
    }

    Memory {
        string id PK
        string userId
        string bunjinId FK
        string text
        string sourceRefs "JSON[]"
    }

    WeeklyExecution {
        string id PK
        string userId
        string weekKey "YYYY-Wxx"
        string proposalId FK
        string note
    }

    Transcript {
        string id PK
        string deviceId
        string sessionId
        int segmentNo
        datetime startAt
        datetime endAt
        string text
    }

    AudioDeletionLog {
        string id PK
        string segmentId UK
        datetime deletedAt
        string reason
    }

    UserSettings {
        string id PK
        string userId UK
        string geminiApiKey "AES-256-GCM暗号化済み"
    }
```

### テーブル一覧

| テーブル | 用途 | 備考 |
|---------|------|------|
| `transcripts` | 文字起こし結果 (レガシー) | v1.4.1以前からの後方互換。新規は `segments` を使用 |
| `bunjins` | 分人 (人格ファセット) | デフォルト5 + カスタム最大3 = 計8 |
| `rule_trees` | ルールツリー (条件分岐) | ユーザーごとに1つ |
| `rule_tree_nodes` | ルールツリーノード | 自己参照で親子関係。深度制限10 |
| `published_versions` | 公開バージョン | ルールツリーのJSONスナップショット |
| `sessions` | 録音セッション | ACTIVE / STOPPED |
| `segments` | 音声セグメント | Transcriptの後継。STT状態管理付き |
| `proposals` | AI提案 | 日次サマリー / タスク提案 |
| `tasks` | タスク | TODO -> DOING -> DONE -> ARCHIVED |
| `weekly_executions` | 週次実行記録 | 提案の週次レビュー追跡 |
| `swls_responses` | SWLS回答 | 主観的幸福度5問 (日次) |
| `memories` | メモリー | 学習記録。追加のみ (append-only設計) |
| `user_settings` | ユーザー設定 | Gemini APIキーのAES-256-GCM暗号化保存 |
| `audio_deletion_logs` | 音声削除ログ | STT完了後の音声削除追跡 |

### 主要な制約とインデックス

- `bunjins`: `@@unique([userId, slug])` - ユーザーごとにslugは一意
- `published_versions`: `@@unique([ruleTreeId, version])` - バージョン番号は一意
- `swls_responses`: `@@unique([userId, dateKey])` - 日次1回のみ
- `weekly_executions`: `@@unique([userId, weekKey, proposalId])` - 週次実行は重複不可
- `audio_deletion_logs`: `@unique segmentId` - セグメントごとに1レコード
- 全テーブルに `userId` インデックスあり

### タスク状態遷移マトリクス

```
FROM\TO   | TODO | DOING | DONE | ARCHIVED
----------|------|-------|------|----------
TODO      |  -   |  OK   |  NG  |   OK
DOING     |  OK  |  -    |  OK  |   OK
DONE      |  OK  |  NG   |  -   |   OK
ARCHIVED  |  NG  |  NG   |  NG  |   -
```

- **ARCHIVED は最終状態** (復帰不可)
- DONE -> TODO は許可 (やり直し)
- DONE -> DOING は禁止
- 14日以上更新なしのタスクは自動アーカイブ (`/api/cron/archive-tasks`)

### STT状態遷移マトリクス

```
FROM\TO      | PENDING | PROCESSING | DONE | FAILED
-------------|---------|------------|------|--------
PENDING      |   -     |    OK      |  OK  |   OK
PROCESSING   |   NG    |    -       |  OK  |   OK
DONE         |   NG    |    NG      |  -   |   NG
FAILED       |   NG    |    OK      |  NG  |   -
```

- **PENDING → DONE**: サーバーサイド同期STT（PROCESSING経由不要）
- **FAILED → PROCESSING**: リトライ時のみ
- **DONE は最終状態** (逆行不可)
- バリデーション: `lib/validators.js` の `validateSttTransition()`

---

## 3. API一覧

### ヘルスチェック

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/health` | システム状態確認 (DB + Gemini) | 不要 |

**レスポンス:**
```json
{ "ok": true, "database": true, "gemini": true }
```

---

### 文字起こし

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| POST | `/api/transcribe` | 音声ファイルを文字起こし | MOCK_USER_ID |
| GET | `/api/transcribe` | 文字起こし履歴取得 | MOCK_USER_ID |

**POST `/api/transcribe`**
- Content-Type: `multipart/form-data`
- パラメータ:
  - `audio` (File, 必須) - 音声ファイル (max 6MB, audio/mp4, audio/mpeg, audio/m4a, audio/aac, audio/wav)
  - `deviceId` (string, 必須)
  - `sessionId` (string, 必須)
  - `segmentNo` (int, オプション)
  - `startAt` (ISO8601, オプション)
  - `endAt` (ISO8601, オプション)
- Vercel maxDuration: 60秒
- レスポンス:
```json
{ "success": true, "transcriptId": "...", "segmentId": "...", "text": "..." }
```
- 副作用: Transcript + Session (auto-create) + Segment を同時作成

**GET `/api/transcribe`**
- クエリパラメータ: `deviceId`, `sessionId` (両方オプション)
- レスポンス: `{ "transcripts": [...] }` (max 100件)

---

### セッション

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| POST | `/api/sessions` | セッション作成 | MOCK_USER_ID |
| GET | `/api/sessions` | セッション一覧取得 | MOCK_USER_ID |
| GET | `/api/sessions/:id` | セッション詳細取得 (セグメント含む) | MOCK_USER_ID |
| PATCH | `/api/sessions/:id` | セッション停止 | MOCK_USER_ID |

**POST `/api/sessions`**
- Body: `{ "deviceId": "string" }` (必須)
- 最新の PublishedVersion を自動紐付け
- レスポンス: `{ "session": {...} }` (201)

**GET `/api/sessions`**
- クエリ: `limit` (1-200, デフォルト50)
- レスポンス: `{ "sessions": [...] }` (セグメント数 `_count.segments` 含む)

**GET `/api/sessions/:id`**
- レスポンス: セッション + segments[] + ruleVersion

**PATCH `/api/sessions/:id`**
- ステータスを STOPPED に変更、endedAt を設定

---

### セグメント

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/segments` | セグメント一覧取得 | MOCK_USER_ID |
| GET | `/api/segments/:id` | セグメント詳細取得 | MOCK_USER_ID |
| PATCH | `/api/segments/:id` | STTステータス/テキスト更新 | MOCK_USER_ID |

**GET `/api/segments`**
- クエリ: `sessionId` (オプション), `limit` (1-200, デフォルト100)
- レスポンス: `{ "segments": [...] }` (bunjin含む)

**PATCH `/api/segments/:id`**
- Body: `{ "sttStatus": "DONE", "text": "..." }` (少なくとも1つ必須)
- sttStatus: PENDING / PROCESSING / DONE / FAILED
- PROCESSING遷移時: sttAttemptCount を自動インクリメント

---

### 分人 (Bunjin)

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/bunjins` | 全分人取得 | MOCK_USER_ID |
| POST | `/api/bunjins` | カスタム分人作成 | MOCK_USER_ID |
| PATCH | `/api/bunjins/:id` | 分人更新 | MOCK_USER_ID |
| DELETE | `/api/bunjins/:id` | カスタム分人削除 | MOCK_USER_ID |

**GET `/api/bunjins`**
- デフォルト分人が先頭
- レスポンス: `{ "bunjins": [...] }`

**POST `/api/bunjins`**
- Body: `{ "slug": "string", "displayName": "string", "description?": "", "color?": "#6366f1", "icon?": "person" }`
- slug: 小文字英数字+ハイフンのみ (`/^[a-z0-9-]+$/`)
- カスタム分人は最大3つまで
- レスポンス: `{ "bunjin": {...} }` (201)

**PATCH `/api/bunjins/:id`**
- Body: `{ "displayName?", "description?", "color?", "icon?", "slug?" }`
- デフォルト分人のslug変更は不可
- color: `#` + 6桁hex

**DELETE `/api/bunjins/:id`**
- デフォルト分人は削除不可
- レスポンス: `{ "success": true }` (204)

---

### タスク

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/tasks` | タスク一覧取得 | MOCK_USER_ID |
| POST | `/api/tasks` | タスク作成 | MOCK_USER_ID |
| PATCH | `/api/tasks/:id` | タスクステータス更新 | MOCK_USER_ID |

**GET `/api/tasks`**
- クエリ: `status` (オプション、省略時ARCHIVED以外), `bunjinId` (オプション), `limit` (1-200, デフォルト50)
- ソート: priority DESC, createdAt DESC
- レスポンス: `{ "tasks": [...] }` (bunjin含む)

**POST `/api/tasks`**
- Body: `{ "title": "string", "body?": "", "bunjinId?": null, "priority?": 0 }`
- title: max 500文字, priority: 0-100
- レスポンス: `{ "task": {...} }` (201)

**PATCH `/api/tasks/:id`**
- Body: `{ "status": "DOING" }`
- 状態遷移マトリクスで検証 (validators.js)
- ARCHIVED移行時に archivedAt 設定

---

### 提案 (Proposal)

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/proposals` | 提案一覧取得 | MOCK_USER_ID |
| POST | `/api/proposals` | 日次提案生成 (Gemini) | MOCK_USER_ID |
| PATCH | `/api/proposals/:id` | 提案の確定/却下 | MOCK_USER_ID |

**POST `/api/proposals`**
- Body: `{ "dateKey": "YYYY-MM-DD" }`
- Vercel maxDuration: 60秒
- 処理: その日のDONEセグメント取得 -> テキスト結合 -> Gemini生成 -> DB保存
- 生成内容: SUMMARY x1 + TASK x最大3 (実装は2タイプのみ: SUMMARY / TASK)
- レスポンス: `{ "proposals": [...] }` (201)

**PATCH `/api/proposals/:id`**
- Body: `{ "status": "CONFIRMED" }` or `{ "status": "REJECTED" }`
- CONFIRMED + type=TASK の場合: 新規タスクを自動作成
- レスポンス: `{ "proposal": {...}, "task": {...} }` (task は TASK提案確定時のみ)

---

### ルールツリー

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/rule-trees` | ルールツリー取得 | MOCK_USER_ID |
| PUT | `/api/rule-trees` | ドラフトツリー全置換 | MOCK_USER_ID |
| POST | `/api/rule-trees/publish` | ツリー検証・公開 | MOCK_USER_ID |

**GET `/api/rule-trees`**
- 初回アクセス時に空ツリーを自動生成
- レスポンス: `{ "id": "...", "nodes": [...] }`

**PUT `/api/rule-trees`**
- Body: `{ "nodes": [{ "id?", "parentId?", "type", "label?", "condition?", "bunjinSlug?", "sortOrder" }] }`
- トランザクションで全ノード削除 -> 再作成 (2パス: ルートノード -> 子ノード)
- レスポンス: `{ "nodes": [...] }`

**POST `/api/rule-trees/publish`**
- 検証: サイクル検出、深度制限(max 10)、終端ノードがbunjinか、孤立ノード
- JSONスナップショットを PublishedVersion として保存
- レスポンス: `{ "publishedVersion": {...} }` (201)

---

### SWLS (主観的幸福度)

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/swls` | SWLS回答取得 | MOCK_USER_ID |
| POST | `/api/swls` | SWLS回答作成/更新 | MOCK_USER_ID |

**GET `/api/swls`**
- クエリ: `dateKey` (YYYY-MM-DD, 省略時は今日)
- レスポンス: `{ "success": true, "response": {...} }`

**POST `/api/swls`**
- Body: `{ "dateKey?": "YYYY-MM-DD", "q1?": "", "q2?": "", "q3?": "", "q4?": "", "q5?": "" }`
- Upsert: 既存あれば更新、なければ作成
- 各回答: max 500文字

---

### メモリー

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/memories` | メモリー一覧取得 | MOCK_USER_ID |
| POST | `/api/memories` | メモリー作成 | MOCK_USER_ID |
| PATCH | `/api/memories/:id` | メモリーテキスト更新 | MOCK_USER_ID |

**POST `/api/memories`**
- Body: `{ "text": "string", "bunjinId?": null, "sourceRefs?": "[]" }`
- text: 空文字不可
- sourceRefs: JSON文字列
- レスポンス: `{ "success": true, "memory": {...} }` (201)

**PATCH `/api/memories/:id`**
- Body: `{ "text": "string" }` (max 50000文字)

---

### 週次レビュー

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/weekly-review` | 週次実行記録取得 | MOCK_USER_ID |
| POST | `/api/weekly-review` | 週次実行記録作成 | MOCK_USER_ID |

**GET `/api/weekly-review`**
- クエリ: `weekKey` (必須, "YYYY-Wxx")
- レスポンス: `{ "executions": [...] }` (proposal含む)

**POST `/api/weekly-review`**
- Body: `{ "weekKey": "YYYY-Wxx", "proposalId": "string", "note?": "" }`
- 重複チェック (userId + weekKey + proposalId)
- レスポンス: `{ "execution": {...} }` (201)

---

### ユーザー設定

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/settings` | 設定取得 (APIキー有無のみ) | MOCK_USER_ID |
| PUT | `/api/settings` | 設定更新 (APIキー保存) | MOCK_USER_ID |
| DELETE | `/api/settings` | APIキー削除 | MOCK_USER_ID |

**GET `/api/settings`**
- レスポンス: `{ "settings": { "hasGeminiApiKey": true, "updatedAt": "..." } }`
- APIキーの値は返さない（セキュリティ）

**PUT `/api/settings`**
- Body: `{ "geminiApiKey": "string" }`
- AES-256-GCM暗号化してDB保存 (`lib/crypto.js`)
- バリデーション: 10文字以上

**DELETE `/api/settings`**
- APIキーをnullに設定

**Gemini APIキーの優先順位:**
1. 環境変数 `GEMINI_API_KEY` (最優先)
2. DB保存キー (`user_settings.gemini_api_key`, 復号して使用)
3. どちらもなければ `null` → STTと提案生成が無効

---

### Cron

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/api/cron/archive-tasks` | 古いタスク自動アーカイブ | CRON_SECRET |

- Authorization: `Bearer {CRON_SECRET}`
- 14日以上更新なしの TODO/DOING タスクを ARCHIVED に変更
- レスポンス: `{ "success": true, "archivedCount": 0, "archivedIds": [] }`

---

## 4. 環境変数

### バックエンド (Next.js / Vercel)

| 変数名 | 用途 | 必須 | 設定場所 |
|--------|------|------|---------|
| `DATABASE_URL` | Supabase PostgreSQL接続文字列 (Transaction mode) | 必須 | `.env` / Vercel環境変数 |
| `DIRECT_URL` | Supabase PostgreSQL直接接続 (Session mode, マイグレーション用) | 必須 | `.env` / Vercel環境変数 |
| `SUPABASE_URL` | SupabaseプロジェクトURL | 必須 | `.env` / Vercel環境変数 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key (RLSバイパス) | 必須 | `.env` / Vercel環境変数 |
| `GEMINI_API_KEY` | Google Gemini APIキー (STT + 提案生成) | 必須 | `.env` / Vercel環境変数 |
| `ENCRYPTION_KEY` | AES-256-GCM暗号化キー (32byte hex=64文字) | 任意 | `.env` / Vercel環境変数 |
| `CRON_SECRET` | Cronジョブ認証トークン | 任意 | Vercel環境変数 |
| `DEV_AUTH_BYPASS` | 開発環境での認証バイパス | 任意 | `.env` (開発環境のみ) |
| `NEXT_PUBLIC_SUPABASE_URL` | クライアント側Supabase URL (Web認証用) | 必須 | `.env` / Vercel環境変数 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | クライアント側Supabase anon key (Web認証用) | 必須 | `.env` / Vercel環境変数 |
| `NODE_ENV` | 実行環境 (development/production) | 自動 | Next.js自動設定 |

**ENCRYPTION_KEY について:**
- 未設定時は `DATABASE_URL` のSHA256ハッシュをフォールバック使用
- `lib/crypto.js` で `encrypt()` / `decrypt()` に使用
- ユーザー設定のGemini APIキーをDBに暗号化保存する際に必要

**DATABASE_URL 形式 (Supabase Transaction mode / Supavisor):**
```
postgresql://postgres.[ref]:[password]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&statement_cache_size=0
```

**DIRECT_URL 形式 (Supabase Session mode):**
```
postgresql://postgres.[ref]:[password]@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
```

### Flutter (モバイルアプリ)

| 変数名 | 用途 | 必須 | 設定方法 |
|--------|------|------|---------|
| `API_BASE_URL` | バックエンドAPIのベースURL | 必須 | `--dart-define=API_BASE_URL=https://...` または `--dart-define-from-file=env/prod.json` |

**注意:** `API_BASE_URL` が空の場合、起動時に警告ログを出力し、文字起こしAPI呼び出し時にエラーとなる。

### 共通定数 (MOCK_USER_ID)

以下の3箇所で同一値 `mock-user-001` を使用:

| ファイル | パス |
|---------|------|
| `lib/constants.js` | `MOCK_USER_ID = 'mock-user-001'` |
| `flutter_app/lib/core/constants.dart` | `AppConstants.mockUserId = 'mock-user-001'` |
| `prisma/seed.mjs` | `MOCK_USER_ID = 'mock-user-001'` |

> Web UIはSupabase Auth (メール+パスワード) でログイン。`app/contexts/auth-context.js` が認証状態管理、`app/hooks/use-api.js` が全API呼び出しにJWT自動付与。開発環境では `DEV_AUTH_BYPASS=true` でモックユーザーにフォールバック。

---

## 5. 機能接続関係図

### 録音 -> 文字起こしフロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Flutter as Flutter App
    participant BG as Background Service
    participant API as Next.js API
    participant Gemini as Gemini API
    participant DB as Supabase DB

    User->>Flutter: 録音開始
    Flutter->>BG: start (sessionId, recordingsDir)
    BG-->>Flutter: onRecordingStarted

    loop 10分ごとにセグメント分割
        BG->>BG: 音声録音 (AAC-LC)
        BG-->>Flutter: onSegmentCompleted (filePath)
        Flutter->>API: POST /api/transcribe (audio, metadata)
        API->>Gemini: transcribeAudio (base64)
        Gemini-->>API: テキスト
        API->>DB: Transcript + Session + Segment 作成
        API-->>Flutter: { transcriptId, segmentId, text }
    end

    User->>Flutter: 録音停止
    Flutter->>BG: stop
    BG-->>Flutter: onRecordingStopped
    Flutter->>API: PATCH /api/sessions/:id (STOPPED)
```

### 提案生成フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Web as Web Dashboard
    participant API as Next.js API
    participant Gemini as Gemini API
    participant DB as Supabase DB

    User->>Web: Daily画面で提案生成
    Web->>API: POST /api/proposals { dateKey }
    API->>DB: 当日のDONEセグメント取得
    API->>Gemini: generateProposals (テキスト結合)
    Gemini-->>API: [SUMMARY x1, TASK x0-3]
    API->>DB: Proposal作成 (PENDING)
    API-->>Web: { proposals }

    User->>Web: タスク提案を確定
    Web->>API: PATCH /api/proposals/:id { status: CONFIRMED }
    API->>DB: Proposal更新 + Task自動作成
    API-->>Web: { proposal, task }
```

### オフラインキューフロー

```mermaid
sequenceDiagram
    participant Flutter as Flutter App
    participant Queue as Unified Queue (SQLCipher)
    participant Monitor as Connectivity Monitor
    participant API as Next.js API

    Flutter->>Queue: enqueue (endpoint, method, payload)

    Note over Monitor: オンライン復帰検知
    Monitor->>Queue: flush()

    loop キューが空になるまで
        Queue->>API: HTTP リクエスト送信
        alt 成功 (2xx)
            Queue->>Queue: markCompleted
        else クライアントエラー (4xx)
            Queue->>Queue: markCompleted (リトライ不要)
        else サーバーエラー (5xx)
            alt リトライ < 5
                Queue->>Queue: markFailed (retryCount++)
            else リトライ >= 5
                Queue->>Queue: markDeadLetter
            end
        end
    end
```

### ルールツリーワークフロー

```mermaid
flowchart LR
    A[ドラフト編集] -->|PUT /api/rule-trees| B[ノード全置換]
    B --> C{検証}
    C -->|POST /api/rule-trees/publish| D[バリデーション]
    D -->|サイクル検出| E[エラー]
    D -->|深度 > 10| E
    D -->|終端が非bunjin| E
    D -->|OK| F[PublishedVersion作成]
    F --> G[セッション作成時に自動紐付け]
```

---

## 6. 外部サービス依存

### Vercel

| 項目 | 詳細 |
|------|------|
| 用途 | Next.jsホスティング、サーバーレス関数、Cronジョブ |
| プラン | 無料/Pro |
| 関数タイムアウト | transcribe: 60秒, proposals: 60秒, 他: デフォルト |
| 設定ファイル | `vercel.json` |

### Supabase PostgreSQL

| 項目 | 詳細 |
|------|------|
| 用途 | プライマリデータベース |
| プロジェクトID | `dhwuekyutobpnocwhdut` |
| リージョン | `ap-northeast-1` (東京) |
| 接続方式 | PgBouncer経由 (Transaction mode: port 6543) |
| 直接接続 | Session mode: port 5432 (マイグレーション用) |
| 接続プール | Supabase Supavisor (組み込みプーラー) |
| Postgres Version | 17.6.1.063 |

### ~~Supabase Edge Functions~~ (廃止)

> v2.0.0-beta.6 で Storage+Edge Function フローを廃止。
> 文字起こしは Flutter → `POST /api/transcribe` (multipart) → Gemini API の単一フローに統一。

### Google Gemini API

| 項目 | 詳細 |
|------|------|
| 用途 | 音声文字起こし (STT) + 提案テキスト生成 |
| モデル | `gemini-2.0-flash` (安定版) |
| SDK | `@google/generative-ai` v0.24.x |
| 入力形式 (STT) | base64エンコード音声 + テキストプロンプト |
| 入力形式 (提案) | テキストプロンプト (セグメントテキスト結合) |
| 出力形式 (STT) | 日本語テキスト |
| 出力形式 (提案) | JSON配列 `[{type, title, body}]` |

### GitHub Releases

| 項目 | 詳細 |
|------|------|
| 用途 | Flutter APK配布 |
| URL | `https://github.com/toshi-yaminabe/record-app/releases` |

---

## 7. 現在の問題点

> 詳細な課題管理・対応履歴は [GitHub Issues](https://github.com/toshi-yaminabe/record-app/issues) で管理。
> ローカル参照: **ISSUES.md** (アクティブ課題のサマリーのみ + UXコンテキスト)。

### 現在のオープンIssue（2026-02-19 設計整合性監査で起票）

| Issue | Severity | 概要 |
|-------|----------|------|
| #58 | CRITICAL | Proposal-bunjin リレーション不在（DBマイグレーション必要） |
| #59 | CRITICAL | E1-E5 UXフロー未実装（ガイド付きUI設計必要） |
| #60 | HIGH | 分人Flutter/Webシグネチャ同期（形/パターン未対応） |
| #61 | MEDIUM | CSPヘッダー未設定、DEV_AUTH_BYPASSフォールバック冗長、他 |
| #62 | LOW | maskSensitiveMeta浅いマスク、rule-tree-service O(n) shift、他 |

### 解決済み（v2.0.0-beta.6 パイプライン復旧）

- Vercel `DATABASE_URL` が旧Neon DB指向 → Supabase Pooler (aws-1) に修正
- Vercel `SUPABASE_URL` / `SERVICE_ROLE_KEY` 未設定/破損 → 正しい値を設定
- Storage+Edge Function フロー死コード → Flutter/バックエンド両方から完全削除
- STTフローを ServerEngine (multipart POST) 単一フローに統一
- `/api/transcribe` のDeprecation警告ヘッダー削除

### 解決済み（2026-02-17 Phase 2バッチ修正）

- ~~#4 認証がモック~~ (Supabase Auth基盤実装済み、CLOSED)
- ~~#29 テストカバレッジ不足~~ (バックエンド85.84% statements, Flutter 59テスト通過)
- ~~#32 オフラインキュー2DB統合~~ (unified_queue.db + BaseQueueDB + MigrationHelper)
- ~~#34 Flutter通信・ローカルデータセキュリティ~~ (HTTPS強制 + SQLCipher暗号化)

### 解決済み（2026-02-17バッチ修正）

- ~~#27 セキュリティ脆弱性~~ (x-real-ip, immutable context, userId validation)
- ~~#28 ミドルウェア残作業~~ (Zodバリデーション統合)
- ~~#30 レートリミット~~ (Upstash Redis + インスタンスキャッシュ)
- ~~#31 AudioDeletionLog~~ (EF process-audio v3で実装済み)
- ~~#35 console.log散在~~ (lib/logger.js 構造化ログ統一)
- ~~#37 Web 10タブ~~ (5タブに簡略化)
- ~~#38 コード重複~~ (base-service.js ヘルパー導入)
- ~~#39 CSS-in-JS肥大化~~ (CSS Modules分離)
- ~~#40 Vercel環境変数~~ (.env.example更新済み)
- ~~#42 Storage RLS~~ (INSERT/SELECT/DELETE ポリシー設定)

### 解決済み（2026-02-14バッチ修正）

以下は #5〜#25 で解決済み:
- ~~DB接続503チェック~~ (#5)、~~エンベロープ不一致~~ (#6)、~~オフラインキュー~~ (#7)
- ~~API_BASE_URL起動ブロック~~ (#8)、~~タイムアウト不統一~~ (#9)、~~ステータス不一致~~ (#10)
- ~~deviceId二重初期化~~ (#11)、~~flush fire-and-forget~~ (#12)、~~複数インスタンス~~ (#13)
- ~~Transcript二重管理~~ (#14)、~~バージョン不一致~~ (#15)、~~ENCRYPTION_KEY~~ (#16)
- ~~ルールツリー2パス~~ (#17)、~~SQLite try-catch~~ (#18)、~~SQLite onUpgrade~~ (#19)
- ~~GEMINI_API_KEY~~ (#20)、~~QueueEntry~~ (#21)、~~transcribe冪等性~~ (#22)
- ~~接続デバウンス~~ (#23)、~~markCompleted 4xx~~ (#24)、~~force-unwrap~~ (#25)

---

## 8. セットアップ手順

### バックエンド

```bash
# 1. 依存インストール
cd ~/apps/record-app
npm install

# 2. 環境変数設定
cp .env.example .env
# DATABASE_URL と GEMINI_API_KEY を設定

# 3. Prismaマイグレーション
npx prisma migrate dev

# 4. Prisma Client生成
npx prisma generate

# 5. 初期データ投入
node prisma/seed.mjs

# 6. 開発サーバー起動
npm run dev
```

### Flutter

```bash
# 1. 依存インストール
cd ~/apps/record-app/flutter_app
flutter pub get

# 2. API URLを指定してビルド
flutter run --dart-define=API_BASE_URL=http://localhost:3000

# または env/prod.json を作成して:
flutter run --dart-define-from-file=env/prod.json
```

### Vercel デプロイ

```bash
# Vercel環境変数を設定:
# - DATABASE_URL (Supabase Pooler接続文字列, aws-1-ap-northeast-1)
# - SUPABASE_URL (https://[ref].supabase.co)
# - SUPABASE_SERVICE_ROLE_KEY
# - GEMINI_API_KEY
# - CRON_SECRET (タスク自動アーカイブ用)

vercel deploy
```

---

## 付録: レスポンスエンベロープ

全APIはミドルウェアで `{ success: true, data: <result> }` エンベロープでラップ。

**クライアント側のアンラップ:**
- **Web (useApi)**: `return json.data ?? json` でエンベロープを自動除去
- **Flutter (AuthenticatedClient)**: `_unwrap()` メソッドで `json['data']` を抽出

**エラー形式:**
```json
{ "error": "エラーメッセージ" }
```

**HTTPステータスコード:**

| コード | 意味 | 発生条件 |
|--------|------|---------|
| 200 | 成功 | 正常レスポンス |
| 201 | 作成成功 | POST成功時 |
| 204 | 削除成功 | DELETE成功時 |
| 400 | バリデーションエラー | 必須フィールド不足、不正な値 |
| 401 | 認証エラー | CRON_SECRET不一致 |
| 404 | 未検出 | リソースが存在しない |
| 409 | 競合 | ユニーク制約違反、上限超過 |
| 413 | ペイロード過大 | 音声ファイル > 6MB |
| 415 | 非対応メディアタイプ | 不正な音声フォーマット |
| 500 | サーバーエラー | 未知のエラー |
| 503 | サービス利用不可 | DATABASE_URL未設定 |

---

## 付録: デフォルト分人

| slug | 表示名 | 色 | アイコン | 説明 |
|------|--------|-----|---------|------|
| work | 仕事モード | #3b82f6 | work | 業務・プロジェクト関連 |
| creative | クリエイティブ | #8b5cf6 | palette | 創作・アイデア出し |
| social | ソーシャル | #ec4899 | people | 対人関係・コミュニケーション |
| rest | 休息 | #10b981 | self_improvement | リラックス・回復 |
| learning | 学習 | #f59e0b | school | 勉強・スキルアップ |

seed実行時に5件作成。カスタム分人は最大3件追加可能 (計8件上限)。

---

## 9. UX体験定義と技術的負債マトリクス

> 2026-02-15 UX起点技術的負債調査で策定。4視点（アーキテクチャ/品質/セキュリティ/簡略化）のエージェントチームが調査。

### 9.1 UX体験定義（E1-E5）

本アプリの根幹は **24時間（16時間セッション）バックグラウンド録音**。ユーザーは朝Startを押すだけで、アプリが終日耳を傾ける。各分人（仕事/家庭/自分/コミュニティ/自由枠）に「今日何があったかを全て把握している執事」が生まれる。

| # | 体験 | 概要 | ユーザー操作 |
|---|------|------|-------------|
| E1 | 常に聴いている | 16時間バックグラウンド録音。10分/無音で自動分割。オフラインでも途切れない | 朝Start（10秒） |
| E2 | 分人別に整理される | ルールツリーで自動分人割当。セッション中ルール不変 | なし（自動） |
| E3 | 執事が一手を出す | 1日分のテキストを蒸留しAIが最小アクション提案。回復 or 一歩前進。反省や長文ではない | 夕方に承認/却下（2分） |
| E4 | 軽く振り返る | 「やったか？」にYes/Noで答えるだけ。崩れパターンが言語化される | 週末Yes/No（5分） |
| E5 | 執事が育つ | 採用メモリーが蓄積（append-only、新情報優先）。使うほど自分専用の執事になる | なし（自動） |

**1日のフロー:**
```
朝（10秒）   Startボタン → バックグラウンド録音開始
終日（0秒）   自動で録音・分割・STT・分人割当が回り続ける
夕方（2分）   録音停止 → 執事が蒸留 → 提案を承認/却下
週末（5分）   「やったか？」Yes/No → 崩れパターンが見える
```

### 9.2 コア要件（削ってはいけない）

| 要件 | 体験 | 実装 | 理由 |
|------|------|------|------|
| FGSバックグラウンド録音 | E1 | RecordingService + BackgroundRecordingHandler | 16時間連続録音の根幹 |
| 10分/無音自動分割 | E1 | BackgroundRecordingHandler | セグメント粒度の基盤 |
| オフラインキュー | E1 | OfflineQueueService + SQLite | 電波断でも録音が止まらない |
| STTパイプライン | E1 | Gemini API (transcribeAudio) | 音声→テキスト変換 |
| ルールツリー | E2 | RuleTreeService + RuleTreeNode | 自動分人割当の条件分岐 |
| PublishedVersion | E2 | JSONスナップショット | セッション中のルール不変を保証 |
| 音声短期保持→即削除 | E1 | AudioDeletionLog (実装済み #31) | プライバシー要件 |
| メモリー蓄積 | E5 | Memory (append-only) | 執事の学習基盤 |

### 9.3 技術的負債マトリクス

| Issue | Severity | UX影響 | カテゴリ | 修正コスト | 簡略化効果 |
|-------|----------|--------|---------|-----------|-----------|
| #4 認証モック | CRITICAL | E1-E5 | セキュリティ | XL | 本番運用の前提条件 |
| #26 ミドルウェア不在 | CRITICAL | E1-E5 | アーキテクチャ | L | 30箇所の重複→1箇所に |
| #27 テスト5% | CRITICAL | E1-E5 | 品質 | L | デプロイ信頼性向上 |
| #28 レートリミット0 | CRITICAL | E1,E3 | セキュリティ | M | コスト攻撃防止 |
| #29 AudioDeletionLog | HIGH | E1 | セキュリティ | M | プライバシー要件達成 |
| #30 オフライン2DB | HIGH | E1 | アーキテクチャ | M | 449行→300行（33%減） |
| #31 IPC タイムアウト | HIGH | E1 | アーキテクチャ | S | 起動失敗の削減 |
| #32 Flutter通信 | HIGH | E1,E5 | セキュリティ | M | ローカルデータ保護 |
| #33 Web 10タブ | MEDIUM | E2-E4 | 簡略化 | M | 10→5タブ（50%減） |
| #34 コード重複 | MEDIUM | 保守性 | 簡略化 | L | 390行削減 |
| #35 console.log | MEDIUM | 保守性 | 品質 | M | 本番ログ制御 |
| #36 CSS肥大 | LOW | 保守性 | 簡略化 | S | CSS分離で可読性向上 |
| #37 ドキュメント | LOW | 開発者体験 | ドキュメント | S | 即時修正可 |

### 9.4 簡略化ロードマップ（UX維持×複雑さ削減）

**Phase 1: セキュリティ基盤（#4 → #26 → #28）**
- Supabase Auth導入 → ミドルウェア層構築 → レートリミット追加
- 全ての前提条件。これなしに本番運用不可

**Phase 2: 品質ゲート（#27 → #29）**
- E1-E5最小テスト5本 + GitHub Actions CI
- AudioDeletionLog実装（プライバシー要件）

**Phase 3: コア体験の堅牢化（#31 → #30 → #32）**
- IPC タイムアウト延長（S: 即効性高い）
- オフラインDB統合（M: 33%コード削減）
- Flutter通信暗号化

**Phase 4: 簡略化・保守性（#33 → #34 → #35 → #36 → #37）**
- Web タブ整理 → コード重複解消 → ログ統一 → CSS分離 → ドキュメント修正
- UXに直接影響しないが開発速度を向上

### 9.5 調査で判明した事実

- **Proposalタイプ**: KNOWLEDGE.md等で「4タイプ」と記載される箇所があるが、実装は **2タイプ（SUMMARY / TASK）のみ**（`lib/constants.js:38-41`）
- **PendingTranscribeStore**: BaseQueueDB継承でunified_queue.dbに統合済み (#32で実装完了)
- **RecordingService IPC簡素化**: 調査の結果、5つのStreamSubscription + readyハンドシェイクは**明示性が高くバグ追跡が容易**であり、簡素化は**E1リスク大のため非推奨**
- **PublishedVersion treeJson + RuleTreeNode二重管理**: treeJsonはセッション実行用スナップショット、RuleTreeNodeはドラフト編集用。役割分離は妥当だが、参照先の明確化が必要
