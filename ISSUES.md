# record-app アクティブ課題

> 詳細・対応履歴は全て [GitHub Issues](https://github.com/toshi-yaminabe/record-app/issues) で管理。
> このファイルはアクティブな課題の参照用サマリー。完了したら削除する。
> **最終更新:** 2026-02-15（UX起点技術的負債調査実施後）

---

## UXコンテキスト

本アプリの5つの体験定義。全issueはこれらに対する影響で優先度を判断する。

| # | 体験 | 概要 | コア実装 |
|---|------|------|---------|
| E1 | 常に聴いている | 朝Startで16時間バックグラウンド録音。10分/無音で自動分割。オフラインでも途切れない | FGS + Segment + OfflineQueue + STT |
| E2 | 分人別に整理される | ルールツリーで自動分人割当。セッション中ルール不変 | RuleTree + PublishedVersion + Bunjin |
| E3 | 執事が一手を出す | 1日分のテキストを蒸留しAIが最小アクション提案。回復 or 一歩前進 | Proposal + Gemini + Memory |
| E4 | 軽く振り返る | 週次で「やったか？」にYes/Noで答えるだけ | WeeklyExecution |
| E5 | 執事が育つ | 採用メモリーが蓄積（append-only、新情報優先）。提案精度が向上 | Memory (append-only) |

**コア要件（削ってはいけない）:** FGS録音、10分/無音分割、オフラインキュー、STTパイプライン、ルールツリー、PublishedVersion、音声短期保持→即削除、AudioDeletionLog、メモリー蓄積

---

## CRITICAL

### [#4](https://github.com/toshi-yaminabe/record-app/issues/4) 認証がモック (MOCK_USER_ID)

| 項目 | 内容 |
|------|------|
| **領域** | backend / flutter |
| **複雑度** | XL |
| **UX影響** | E1-E5全て |
| **依存** | なし |

**問題:** 全20+ APIエンドポイントが `MOCK_USER_ID = 'mock-user-001'` をハードコード使用。マルチユーザー対応不可。Vercel公開時に認証なしで全データアクセス可能（OWASP A01: Broken Access Control）。

**影響範囲:**
- 定義: `lib/constants.js:6`, `flutter_app/lib/core/constants.dart:5`, `prisma/seed.mjs:10`
- API層: `app/api/settings/route.js`・`app/api/transcribe/route.js` で直接import
- サービス層: 全9サービスで `MOCK_USER_ID` 参照

**修正方針:** Supabase Auth導入 → 全サービスにuserId引数化 → Flutter側AuthProvider追加

---

### #26 ミドルウェア層の欠如

| 項目 | 内容 |
|------|------|
| **領域** | backend |
| **複雑度** | L |
| **UX影響** | E1-E5全て |
| **依存** | #4（認証はミドルウェアの一部） |

**問題:** 全20 APIルートに横断的関心事（認証・DB接続確認・入力バリデーション・レートリミット・エラーログ）が散在。`if (!prisma)` チェック30箇所重複、エラーハンドリング不統一、入力バリデーション不在。

**簡略化案:** `lib/middleware.js` に共通ミドルウェア集約。30箇所の重複を1箇所に。全APIを `withApi(handler)` パターンに統一。

**修正コスト:** L（1週間）

---

### #27 テストカバレッジ5%

| 項目 | 内容 |
|------|------|
| **領域** | backend / flutter |
| **複雑度** | L |
| **UX影響** | E1-E5全て |
| **依存** | なし |

**問題:** 20 APIのうちテストありは1つのみ。CI/CD 0%。Flutterテスト0個。

**E1-E5重要度ランキング（テストなしで致命的）:**
- E1: `POST /sessions`, `POST /transcribe`, `GET /segments` — 24h録音の根幹
- E3: `POST /proposals` — 提案生成
- E2: `POST /rule-trees/publish` — 分人割当

**既存テスト（4ファイル, 399行）:** crypto.test.js, validators.test.js は品質良。API層・Flutter層がゼロ。

**修正方針:** E1-E5各1統合テスト（最小5テスト） + GitHub Actions CI

**修正コスト:** L（1週間）

---

### #28 レートリミット未導入

| 項目 | 内容 |
|------|------|
| **領域** | backend |
| **複雑度** | M |
| **UX影響** | E1, E3 |
| **依存** | なし |

**問題:** 全エンドポイントにレートリミットなし。`POST /transcribe` と `POST /proposals` がGemini API呼び出しを含み、コスト攻撃が可能。無認証(#4) × レートリミットなし = 無制限呼び出し。

**修正方針:** Next.js Middleware + IPベースレートリミット

**修正コスト:** M（2-3日）

---

## HIGH

### #29 AudioDeletionLog未実装

| 項目 | 内容 |
|------|------|
| **領域** | backend |
| **複雑度** | M |
| **UX影響** | E1 |

**問題:** `AudioDeletionLog` テーブルはスキーマに定義あり（`prisma/schema.prisma`）だが、実際の削除ログ書き込みが未実装。要件「音声は短期保持→STT後即削除」の監査証跡が不完全。ファイル削除成功→ログ記録失敗のケースで監査ログ欠落。

**修正方針:** STT完了時のSegment処理内にトランザクション化した削除ログ記録を追加。

**修正コスト:** M（2-3日）

---

### #30 オフラインキュー2DB統合検討

| 項目 | 内容 |
|------|------|
| **領域** | flutter |
| **複雑度** | M |
| **UX影響** | E1 |

**問題:** `offline_queue_db.dart`（JSON payload汎用キュー, 190行）と `pending_transcribe_store.dart`（音声ファイルパス専用, 259行）が分離。16時間セッションでの一貫性リスク。

**簡略化案:** 1DB統合（`queue_type` カラムで分岐）。449行 → 推定300行（33%削減）。multipartリトライロジックはfile_pathカラム保持で不変。

**修正コスト:** M（2-3日）

---

### #31 IPC readyハンドシェイク タイムアウト不足

| 項目 | 内容 |
|------|------|
| **領域** | flutter |
| **複雑度** | S |
| **UX影響** | E1 |

**問題:** `recording_service.dart:123` の `timeout(Duration(seconds: 5))` が低スペックAndroid端末で不足する可能性。起動失敗時のリトライロジックなし。

**修正方針:** タイムアウトを10-15秒に延長 + 失敗時リトライ追加。

**修正コスト:** S（1日）

---

### #32 Flutter通信・ローカルデータのセキュリティ

| 項目 | 内容 |
|------|------|
| **領域** | flutter |
| **複雑度** | M |
| **UX影響** | E1, E5 |

**問題:** HTTPS強制なし（HTTPフォールバック可能）。SQLiteデータ平文保存。16時間分の音声・テキストデータがローカルに無防備。

**修正方針:** HTTPS強制 + SQLCipher等によるDB暗号化。

**修正コスト:** M（2-3日）

---

## MEDIUM

### #33 Web 10タブ → エンドユーザー向け整理

| 項目 | 内容 |
|------|------|
| **領域** | web |
| **複雑度** | M |
| **UX影響** | E2-E4 |

**問題:** `app/page.js` に10タブ。「アーキテクチャ」は開発者向け、「セッション」と「履歴」は統合可能。

**簡略化案:** 10タブ → 5タブ（Daily/タスク/分人/履歴/設定）。50%削減。

**修正コスト:** M（2日）

---

### #34 コード重複パターン（Hook/Repository/Provider）

| 項目 | 内容 |
|------|------|
| **領域** | web / flutter |
| **複雑度** | L |
| **UX影響** | 保守性 |

**問題・定量化:**
- Web Hook（use-tasks/use-bunjins/use-proposals）: 共通パターン重複 → 汎用Hook化で93行削減
- Flutter Repository（task/bunjin/proposal）: 共通パターン重複 → BaseRepository化で192行削減
- Flutter Provider（task/bunjin）: 共通パターン重複 → 汎用化で105行削減
- **合計削減見積:** 390行

**修正コスト:** L（1週間）

---

### #35 console.log 33箇所 → 構造化ログ

| 項目 | 内容 |
|------|------|
| **領域** | backend / web |
| **複雑度** | M |
| **UX影響** | 保守性 |

**問題:** 14ファイル・33箇所に `console.log`/`console.error` が散在。本番環境でのログ制御不能。

**修正方針:** `lib/logger.js` 統一ロガー + 本番環境自動無効化。

**修正コスト:** M（2日）

---

## LOW

### #36 CSS-in-JS肥大化

| 項目 | 内容 |
|------|------|
| **領域** | web |
| **複雑度** | S |
| **UX影響** | 保守性 |

**問題:** `app/features/settings/settings-view.js` 352行中CSS 168行（48%）。

**修正方針:** CSS Modules分離。JSファイル 352行 → 180行。

**修正コスト:** S（1日）

---

### #37 ドキュメント精度修正

| 項目 | 内容 |
|------|------|
| **領域** | docs |
| **複雑度** | S |
| **UX影響** | 開発者体験 |

**問題:**
1. `KNOWLEDGE.md` L4: "Web v1.4.1" → v1.5.2（#15で修正済みだがドキュメント未反映）
2. `KNOWLEDGE.md` Section 7: 解決済み問題（#5,#8,#14,#15,#17）が未更新
3. `package.json` L106: バージョン表記

**修正コスト:** S（1時間）

---

## 本バッチで完了したイシュー (2026-02-14)

| # | タイトル | 担当エージェント | 修正概要 |
|---|---------|---------------|---------|
| #5 | DB接続503チェック | backend-api | rule-trees/route.jsに503チェック追加 |
| #6 | エンベロープ不一致 | backend-api + flutter-core | sessions, memories, transcribeのレスポンス統一 |
| #7 | オフラインキュー | flutter-offline | 指数バックオフ、レスポンス検証、整合性改善 |
| #8 | API_BASE_URL | flutter-core | main.dartで起動ブロック+ConfigErrorApp |
| #9 | タイムアウト不統一 | flutter-core | 全リポジトリにGET:15s/POST:30s/upload:60s |
| #10 | ステータス不一致 | docs-config | STOPPED統一確認済み → close推奨 |
| #11 | deviceId二重初期化 | flutter-core | FutureProvider廃止、同期値override一本化 |
| #12 | flush fire-and-forget | flutter-offline | startMonitoringにcatchError追加 |
| #13 | 複数インスタンス | flutter-core | Provider定義からデフォルト生成削除 |
| #14 | Transcript二重管理 | backend-api | transcript.create削除、Segment一本化 |
| #15 | バージョン不一致 | docs-config | package.json 1.4.1→1.5.2 |
| #16 | ENCRYPTION_KEY | docs-config | 本番環境エラー+フォールバック警告追加 |
| #17 | ルールツリー2パス | backend-api | BFSトポロジカルソートに改修 |
| #18 | SQLite try-catch | flutter-offline | 全9メソッドにtry-catch追加 |
| #19 | SQLite onUpgrade | flutter-offline | onUpgradeコールバック追加 |
| #20 | GEMINI_API_KEY | docs-config | プレースホルダー改善(AIzaSy...形式) |
| #21 | QueueEntryコメント | flutter-offline | ステータス定数化 |
| #22 | transcribe冪等性 | backend-api | @@unique制約+upsert化 |
| #23 | 接続デバウンス | flutter-offline | 1秒デバウンスTimer追加 |
| #24 | markCompleted 4xx | flutter-offline | 408/429→リトライ、他→削除に細分化 |
| #25 | force-unwrap | flutter-offline | nullチェックガード追加 |
