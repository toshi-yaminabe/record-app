# record-app Project Memory

## Current Version
- Web: v2.0.0-beta.6 (package.json)
- Flutter: v2.0.0-beta.6 (pubspec.yaml)

## Active Context

### CRITICAL Issues
- #4 認証がモック (MOCK_USER_ID)
- #27 テストカバレッジ5%

### Recent Work
- 2026-02-19: **大規模設計整合性レビュー＆リファクタリング完了** (Phase 0-4, 37ファイル変更)
  - Phase 4スコア: 88→93→95/100 (2回再帰で合格)
  - 詳細レポート: `~/.claude/research/2026-02-19-record-app-phase4-final-review.md`
- 2026-02-15: KNOWLEDGE.md → .claude/knowledge/ 移行完了
- 2026-02-15: UX体験定義・技術的負債マトリクス策定
- 2026-02-14: #5-#25 バッチ修正完了

## Key Decisions
- Transcript kept for backward compat, Segment is new main table
- MOCK_USER_ID="mock-user-001" in 3 places (lib/constants.js, constants.dart, seed.mjs)
- Task state matrix: ARCHIVED is final, DONE→TODO allowed, DONE→DOING blocked
- `previewFeatures = ["driverAdapters"]` for Neon adapter
- `gemini-2.0-flash` (stable) instead of `gemini-2.0-flash-exp`
- Proposal types: SUMMARY / TASK only (2 types, not 4)
- Knowledge files in .claude/knowledge/ (not monolithic KNOWLEDGE.md)
- **Prisma $use → $extends** 移行完了 (Prisma 6対応)
- **Memory append-only**: PATCH API廃止、updateMemoryText非推奨化
- **E5メモリー連携**: proposal生成時に直近20件のメモリーをGeminiプロンプトに注入
- **SWLS UIはDailyCheckinViewに統合** (独立タブではない)
- **全APIルートがサービス層経由** (memories/[id]含む)
- **BUNJIN_LIMITS定数**: constants.jsで一元管理 (MAX_TOTAL:8, MAX_CUSTOM:3)
- **withApiエンベロープ統一**: 全ルートがreturn objectでwithApiが自動ラップ

## Architecture Changes (2026-02-19)
- `lib/prisma.js`: $extends + $allOperations で自動リトライ (exponential backoff)
- `lib/crypto.js`: PBKDF2フォールバック鍵導出 (SHA-256から移行)
- `lib/errors.js`: errorCode + UnauthorizedError追加
- `lib/logger.js`: maskSensitiveMeta (SENSITIVE_KEYS自動マスク)
- `lib/services/settings-service.js`: 新設 (暗号化APIキー管理)
- Flutter: セグメント10分分割、録音状態SharedPreferences永続化

## Supabase Advisory (既知・未修正)
- 14テーブルRLS initplan最適化推奨: `auth.<func>()` → `(select auth.<func>())`
- 5テーブル外部キーインデックス不足: memories, segments, sessions, tasks, weekly_executions
- 4未使用インデックス: transcripts(2), rule_tree_nodes(1), proposals(1)

## Build
```bash
cd ~/apps/record-app && npm install && npx prisma generate && npm run dev
```
