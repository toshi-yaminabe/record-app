# record-app ナレッジ資料

**最終更新:** 2026-02-12
**バージョン:** v1.4.1 (Web v1.4.1 / Flutter v1.5.1+3)

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
        Neon["Neon PostgreSQL<br/>(Serverless)"]
        Gemini["Google Gemini API<br/>(gemini-2.0-flash)"]
    end

    Flutter -->|REST API| API
    Web -->|直接呼び出し| API
    API --> Services
    Services --> Lib
    Lib -->|Prisma 6| Neon
    Lib -->|@google/generative-ai| Gemini
```

### ディレクトリ構造

```
record-app/
├── app/                          # Next.js App Router
│   ├── api/                      # APIルート (19エンドポイント)
│   │   ├── bunjins/              # 分人CRUD
│   │   ├── cron/archive-tasks/   # タスク自動アーカイブ
│   │   ├── health/               # ヘルスチェック
│   │   ├── memories/             # メモリーCRUD
│   │   ├── proposals/            # 提案生成・確定・却下
│   │   ├── rule-trees/           # ルールツリー編集・公開
│   │   ├── segments/             # セグメント一覧・更新
│   │   ├── sessions/             # セッション管理
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
│   ├── prisma.js                 # Prismaクライアント初期化
│   ├── gemini.js                 # Gemini API (STT + 提案生成)
│   ├── constants.js              # 定数定義
│   ├── errors.js                 # カスタムエラークラス
│   ├── validators.js             # バリデーション (状態遷移・ルールツリー)
│   └── services/                 # ビジネスロジック層
│       ├── bunjin-service.js
│       ├── memory-service.js
│       ├── proposal-service.js
│       ├── rule-tree-service.js
│       ├── segment-service.js
│       ├── session-service.js
│       ├── swls-service.js
│       ├── task-service.js
│       └── weekly-service.js
├── prisma/
│   ├── schema.prisma             # DBスキーマ (12モデル)
│   └── seed.js                   # 初期データ投入
├── flutter_app/                  # Flutterモバイルアプリ
│   └── lib/
│       ├── main.dart             # アプリエントリポイント
│       ├── core/                 # 定数・ロガー・エラー
│       ├── data/                 # モデル・リポジトリ・ローカルDB
│       ├── presentation/         # UI (pages/providers/widgets)
│       └── services/             # 録音・文字起こし・オフライン
├── next.config.js                # Next.js設定
├── vercel.json                   # Vercel関数設定
└── package.json                  # v1.4.1
```

### 技術スタック

| 領域 | 技術 | バージョン |
|------|------|-----------|
| Web Framework | Next.js (App Router) | 15.x |
| React | React 19 | 19.x |
| ORM | Prisma | 6.2.x |
| Database | PostgreSQL (Neon Serverless) | - |
| AI/ML | Google Generative AI (Gemini 2.0 Flash) | 0.24.x |
| Flutter | Flutter SDK | >=3.10.0 |
| 状態管理 | Riverpod | 2.6.x |
| 録音 | record パッケージ | 5.2.x |
| バックグラウンド | flutter_background_service | 5.0.x |
| ローカルDB | sqflite | 2.4.x |
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
- 生成内容: SUMMARY x1 + TASK x最大3
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
| `DATABASE_URL` | Neon PostgreSQL接続文字列 | 必須 | `.env` / Vercel環境変数 |
| `GEMINI_API_KEY` | Google Gemini APIキー (STT + 提案生成) | 必須 | `.env` / Vercel環境変数 |
| `CRON_SECRET` | Cronジョブ認証トークン | 任意 | Vercel環境変数 |
| `NODE_ENV` | 実行環境 (development/production) | 自動 | Next.js自動設定 |

**DATABASE_URL 形式:**
```
postgresql://user:password@host/dbname?sslmode=require
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
| `prisma/seed.js` | `MOCK_USER_ID = 'mock-user-001'` |

> 将来的に Supabase Auth 導入時に置き換え予定。

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
    participant DB as Neon DB

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
    participant DB as Neon DB

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
    participant Queue as Offline Queue (sqflite)
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

### Neon (PostgreSQL)

| 項目 | 詳細 |
|------|------|
| 用途 | プライマリデータベース |
| 接続方式 | 直接接続 (Prisma Client) |
| アダプタ | `@prisma/adapter-neon` (v6.2.1) |
| SSL | 必須 (`sslmode=require`) |
| 接続プール | Neon側のコネクションプール使用 |

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

### CRITICAL: 認証がモック

- 全APIエンドポイントで `MOCK_USER_ID = 'mock-user-001'` をハードコードで使用
- マルチユーザー対応不可
- **対策**: Supabase Auth 導入予定

### HIGH: 500エラーの脆弱性

1. **DATABASE_URL 未設定時**: `prisma` が `null` になり、各エンドポイントで 503 チェックが必要
2. **GEMINI_API_KEY 未設定時**: STTと提案生成が完全に無効化。`/api/health` で検知可能
3. **Neon接続の不安定性**: サーバーレス環境でのコールドスタート時に接続タイムアウトの可能性

### MEDIUM: データ整合性

- `Transcript` テーブルと `Segment` テーブルの二重管理 (後方互換のため)
- `/api/transcribe` で両方に書き込むが、`Transcript.sessionId` は文字列型で `Session.id` との外部キー制約なし

### MEDIUM: Flutter API_BASE_URL 設定

- 空文字列の場合、起動時は警告のみで動作を続行
- 文字起こし呼び出し時に初めてエラーが発生 (ユーザー体験の問題)

### LOW: Prisma接続方式

- `lib/prisma.js` で直接 `PrismaClient` を使用
- `@prisma/adapter-neon` はパッケージ依存に含まれているが、prisma.js では使用されていない (schema.prismaに `previewFeatures = ["driverAdapters"]` もなし)
- Neon WebSocket接続 (`ws` パッケージ) も未使用

### LOW: ルールツリー2パス作成の制限

- `replaceRuleTree` は2パスで作成 (ルートノード -> 子ノード)
- 3階層以上のネストでは、第2パスの子ノードが第1パスの子ノードを親に指定できないケースがある

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
node prisma/seed.js

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
# - DATABASE_URL (Neon接続文字列)
# - GEMINI_API_KEY
# - CRON_SECRET (タスク自動アーカイブ用)

vercel deploy
```

---

## 付録: レスポンスエンベロープ

全APIは以下のエラー形式を統一使用:

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
