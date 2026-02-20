# record-app アクティブ課題

> 詳細・対応履歴は全て [GitHub Issues](https://github.com/toshi-yaminabe/record-app/issues) で管理。
> このファイルはアクティブな課題の参照用サマリー。完了したら削除する。
> **最終更新:** 2026-02-20（全Issue解消確認 v2.0.0-beta.13時点）

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

## HIGH

- **#63** セグメント→分人自動割当 — RuleTree評価エンジン未実装。STT完了後にセグメントへのbunjinId自動セットが必要
- **#64** sessionId整合性 — Flutter UUID vs サーバー生成ID の不一致。`transcribe-service.js` がFlutter送信sessionIdを無視

## MEDIUM

- **#65** Flutterオフラインキュー一意制約 — `pending_transcribes` に `(session_id, segment_no)` UNIQUE制約なし、重複蓄積リスク

<!-- sync: 2026-02-20T12:00:00Z -->
