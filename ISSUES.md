# record-app アクティブ課題

> 詳細・対応履歴は全て [GitHub Issues](https://github.com/toshi-yaminabe/record-app/issues) で管理。
> このファイルはアクティブな課題の参照用サマリー。完了したら削除する。
> **最終更新:** 2026-02-17（残14件バッチ修正後）

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

## HIGH

### [#29](https://github.com/toshi-yaminabe/record-app/issues/29) テストカバレッジ不足（目標80%、現状推定30%）

| 項目 | 内容 |
|------|------|
| **領域** | backend / flutter |
| **複雑度** | L |

**現状:** 78テスト通過（middleware, sessions, authorization, api-routes, service-lifecycle）。Flutterテスト0個。
**不足:** E1クリティカルパス（transcribe/segments）、E3（proposals）、Flutter widget/integration。

---

### [#32](https://github.com/toshi-yaminabe/record-app/issues/32) オフラインキュー2DB統合検討

| 項目 | 内容 |
|------|------|
| **領域** | flutter |
| **複雑度** | M |
| **UX影響** | E1 |

**問題:** offline_queue_db(190行) + pending_transcribe_store(259行)の分離。統合で33%削減見込み。

---

### [#34](https://github.com/toshi-yaminabe/record-app/issues/34) Flutter通信・ローカルデータのセキュリティ

| 項目 | 内容 |
|------|------|
| **領域** | flutter |
| **複雑度** | M |
| **UX影響** | E1, E5 |

**問題:** HTTPS強制なし、SQLite平文保存。HTTPS強制 + SQLCipher暗号化必要。

---

<!-- sync: 2026-02-17T00:00:00Z -->
