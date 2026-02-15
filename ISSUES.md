# record-app アクティブ課題

> 詳細・対応履歴は全て [GitHub Issues](https://github.com/toshi-yaminabe/record-app/issues) で管理。
> このファイルはアクティブな課題の参照用サマリー。完了したら削除する。
> **最終更新:** 2026-02-16（Supabase移行Phase3完了後 sync-issues pull）

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

### [#4](https://github.com/toshi-yaminabe/record-app/issues/4) 認証がモック (MOCK_USER_ID ハードコード)

| 項目 | 内容 |
|------|------|
| **領域** | backend / flutter |
| **複雑度** | XL |
| **UX影響** | E1-E5全て |

**問題:** 全APIが `mock-user-001` で動作。DEV_AUTH_BYPASS=trueでバイパス中。マルチユーザー不可。
**進捗:** withApiミドルウェアでJWT検証基盤は実装済み。Flutter AuthNotifier/LoginPageも実装済みだがスキップ中。
**残り:** Supabase Auth本格導入（#41）が解決すれば本issueもclose。

---

### [#27](https://github.com/toshi-yaminabe/record-app/issues/27) セキュリティ: Supabase移行時の認証・アクセス制御の脆弱性

| 項目 | 内容 |
|------|------|
| **領域** | backend / infra |
| **複雑度** | L |
| **UX影響** | E1-E5全て |

**問題:** Supabase移行に伴うセキュリティ課題。RLSポリシー、service_role key管理、環境変数の適切な分離が必要。

---

### [#41](https://github.com/toshi-yaminabe/record-app/issues/41) Supabase Auth本格導入（LoginPage有効化、メール確認設定）

| 項目 | 内容 |
|------|------|
| **領域** | backend / flutter |
| **複雑度** | L |
| **UX影響** | E1-E5全て |
| **依存** | #4 |

**問題:** AuthNotifier/LoginPage実装済みだが無効化中。DEV_AUTH_BYPASS=trueで全APIがmock-user-001動作。
**作業:** Email confirmation有効化 → LoginPage分岐復活 → DEV_AUTH_BYPASS削除 → migrate-user-ids.mjs実行

---

### [#42](https://github.com/toshi-yaminabe/record-app/issues/42) Storage + Edge Function STTパイプライン有効化（Auth導入後）

| 項目 | 内容 |
|------|------|
| **領域** | backend / flutter |
| **複雑度** | M |
| **UX影響** | E1 |
| **依存** | #41 |

**問題:** EF process-audio/Storageバケット準備済みだがAuth無効のため旧multipart POST（Vercel 60秒制限）にフォールバック中。
**効果:** Auth導入後に有効化すればVercel 60秒制限解消、大容量音声対応。

---

## HIGH

### [#28](https://github.com/toshi-yaminabe/record-app/issues/28) ミドルウェア層: withApi統一完了、残作業あり

| 項目 | 内容 |
|------|------|
| **領域** | backend |
| **複雑度** | M |

**進捗:** lib/middleware.js実装済み、全20ルート適用済み。
**残り:** 入力バリデーション（Zodスキーマ）追加、エラーログ構造化（#35連携）。

---

### [#29](https://github.com/toshi-yaminabe/record-app/issues/29) テストカバレッジ不足（目標80%、現状推定30%）

| 項目 | 内容 |
|------|------|
| **領域** | backend / flutter |
| **複雑度** | L |

**現状:** 78テスト通過（middleware, sessions, authorization, api-routes, service-lifecycle）。Flutterテスト0個。
**不足:** E1クリティカルパス（transcribe/segments）、E3（proposals）、Flutter widget/integration。

---

### [#31](https://github.com/toshi-yaminabe/record-app/issues/31) AudioDeletionLog未実装 → STT完了後の削除監査証跡なし

| 項目 | 内容 |
|------|------|
| **領域** | backend |
| **複雑度** | M |
| **UX影響** | E1 |

**問題:** AudioDeletionLogテーブル定義済みだが書き込み未実装。EF process-audioでStorage削除後にログ記録必要。

---

### [#32](https://github.com/toshi-yaminabe/record-app/issues/32) オフラインキュー2DB統合検討

| 項目 | 内容 |
|------|------|
| **領域** | flutter |
| **複雑度** | M |
| **UX影響** | E1 |

**問題:** offline_queue_db(190行) + pending_transcribe_store(259行)の分離。統合で33%削減見込み。

---

### [#33](https://github.com/toshi-yaminabe/record-app/issues/33) IPC readyハンドシェイク タイムアウト不足

| 項目 | 内容 |
|------|------|
| **領域** | flutter |
| **複雑度** | S |
| **UX影響** | E1 |

**問題:** recording_service.dart timeout 5秒 → 低スペック端末で不足。10-15秒に延長 + リトライ追加。

---

### [#34](https://github.com/toshi-yaminabe/record-app/issues/34) Flutter通信・ローカルデータのセキュリティ

| 項目 | 内容 |
|------|------|
| **領域** | flutter |
| **複雑度** | M |
| **UX影響** | E1, E5 |

**問題:** HTTPS強制なし、SQLite平文保存。HTTPS強制 + SQLCipher暗号化必要。

---

### [#40](https://github.com/toshi-yaminabe/record-app/issues/40) Vercel環境変数のSupabase対応

| 項目 | 内容 |
|------|------|
| **領域** | infra |
| **複雑度** | S |

**作業:** Vercel DashboardにDATABASE_URL, DIRECT_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, Upstash Redis設定を追加。GitHub SecretsにSUPABASE_URL, SUPABASE_ANON_KEY追加。

---

## MEDIUM

### [#30](https://github.com/toshi-yaminabe/record-app/issues/30) レートリミット: Upstash Redis未設定時のフォールバック確認

| 項目 | 内容 |
|------|------|
| **領域** | backend |
| **複雑度** | S |

**進捗:** lib/rate-limit.js実装済み、withApiに統合済み。Redis未設定時はスキップ。
**残り:** Vercel本番にUpstash Redis設定、統合テスト。

---

### [#35](https://github.com/toshi-yaminabe/record-app/issues/35) console.log 33箇所 → 構造化ログ統一

| 項目 | 内容 |
|------|------|
| **領域** | backend |
| **複雑度** | M |

**問題:** 14ファイル・33箇所のconsole.log散在。lib/logger.js統一ロガー + 本番自動無効化。

---

### [#37](https://github.com/toshi-yaminabe/record-app/issues/37) Web 10タブ → 5タブ整理

| 項目 | 内容 |
|------|------|
| **領域** | web |
| **複雑度** | M |

**問題:** 10タブ → 5タブ（Daily/タスク/分人/履歴/設定）。アーキテクチャタブは開発者向け。

---

### [#38](https://github.com/toshi-yaminabe/record-app/issues/38) コード重複パターン削減（推定390行削減）

| 項目 | 内容 |
|------|------|
| **領域** | web / flutter |
| **複雑度** | L |

**問題:** Hook/Repository/Providerの共通パターン重複。BaseRepository化等で390行削減見込み。

---

## LOW

### [#36](https://github.com/toshi-yaminabe/record-app/issues/36) ドキュメント精度修正

| 項目 | 内容 |
|------|------|
| **領域** | docs |
| **複雑度** | S |

**問題:** KNOWLEDGE.md バージョン不一致、解決済み問題の未更新。

---

### [#39](https://github.com/toshi-yaminabe/record-app/issues/39) CSS-in-JS肥大化

| 項目 | 内容 |
|------|------|
| **領域** | web |
| **複雑度** | S |

**問題:** settings-view.js 352行中CSS 168行（48%）。CSS Modules分離で180行に。

---

<!-- sync: 2026-02-16T14:30:00Z -->
