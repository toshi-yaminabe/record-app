# record-app アクティブ課題

> 詳細・対応履歴は全て [GitHub Issues](https://github.com/toshi-yaminabe/record-app/issues) で管理。
> このファイルはアクティブな課題の参照用サマリー。完了したら削除する。
> **最終更新:** 2026-02-19（設計整合性監査で#58-#62起票）

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

- **#58** Proposal-bunjinリレーション不在 — ProposalモデルにbunjinId紐付けなし。提案カードの色リボンが常にフォールバック色。DBマイグレーション+分人自動割当ロジック必要
- **#59** E1-E5 UXフロー未実装 — 「朝Start→終日自動→夕方2分→週末5分」のガイドフローが存在しない。大規模UI/UX設計必要

## HIGH

- **#60** 分人Flutter/Webシグネチャ同期 — Flutter側にbunjin-signaturesマッピング不在。色のみで形/パターン未対応

## MEDIUM

- **#61** 複合MEDIUM課題 — CSPヘッダー未設定、DEV_AUTH_BYPASSフォールバック冗長、分人自動割当未実装、confirmProposal bunjin紐付けなし、音声ファイル自動削除未実装、sessionId未使用、Webタブ7（目標5）

## LOW

- **#62** 複合LOW課題 — maskSensitiveMeta浅いマスク、rule-tree-service queue.shift() O(n)、page.jsタブ条件分岐、session-list-view useEffect deps

<!-- sync: 2026-02-19T00:00:00Z -->
