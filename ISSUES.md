# record-app アクティブ課題

> 詳細・対応履歴は全て [GitHub Issues](https://github.com/toshi-yaminabe/record-app/issues) で管理。
> このファイルはアクティブな課題の参照用サマリー。完了したら削除する。
> **最終更新:** 2026-02-14（エージェントチーム一括修正実施後）

---

## CRITICAL

### [#4](https://github.com/toshi-yaminabe/record-app/issues/4) 認証がモック (MOCK_USER_ID)

| 項目 | 内容 |
|------|------|
| **領域** | backend / flutter |
| **複雑度** | XL |
| **依存** | なし |

**問題:** 全20+ APIエンドポイントが `MOCK_USER_ID = 'mock-user-001'` をハードコード使用。マルチユーザー対応不可。

**影響範囲:**
- 定義: `lib/constants.js:6`, `flutter_app/lib/core/constants.dart:5`, `prisma/seed.mjs:10`
- API層: `app/api/settings/route.js`・`app/api/transcribe/route.js` で直接import
- サービス層: 全9サービス (`session-service.js`, `task-service.js`, `proposal-service.js`, `segment-service.js`, `bunjin-service.js`, `memory-service.js`, `rule-tree-service.js`, `swls-service.js`, `weekly-service.js`) で `MOCK_USER_ID` 参照

**修正方針:** Supabase Auth導入 → 全サービスにuserId引数化 → Flutter側AuthProvider追加

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
