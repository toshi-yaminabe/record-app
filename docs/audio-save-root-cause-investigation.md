# 音声保存失敗の根本原因調査（2026-02-16）

## 調査対象
Flutter 録音アプリの「録音→保存→文字起こし」パイプラインが、なぜ恒常的に保存失敗するかをコードベースから特定。

## 現在の想定アーキテクチャ
1. 録音開始時に `sessionId` を払い出す。
2. 各セグメント完了ごとに `TranscribeService.transcribe()` を呼ぶ。
3. 通常フロー（Authあり）:
   - `POST /api/segments` で PENDING セグメント作成
   - Supabase Storage `audio-segments` にアップロード
   - Edge Function `process-audio` を invoke
4. フォールバック（Authなし）:
   - `POST /api/transcribe` multipart で直接送信

## 根本原因（回避策ではなく、失敗の一次原因）

### RC-1: セッションIDの発行元が不整合（最重要）
- Flutter録音側は、録音開始時にローカルで UUID を生成して `sessionId` として使用している。
- しかしバックエンド `POST /api/segments` は、`createSegment()` 内で「その `sessionId` が DB の `sessions` テーブルに存在し、かつ userId 所有であること」を必須チェックしている。
- 録音フロー内では `POST /api/sessions` が呼ばれておらず、DBセッションが作られないため、`/api/segments` は 404(NotFound) で失敗する。

=> 結果: 新フロー（Storage + EF）に入る前段の「PENDINGセグメント作成」で必ず落ちる。

### RC-2: 認証フローが録音画面で実質無効化されている
- `main.dart` で `AuthState` による `LoginPage` 分岐がコメントアウトされており、常に `HomePage` を表示。
- この状態だと未ログインのまま録音開始が可能。
- 未ログイン時は `Supabase.currentUser == null` のため新フローが使えず、旧multipart `/api/transcribe` フォールバックに落ちる。
- ただし `/api/transcribe` は `withApi(requireAuth=true)` により原則 Bearer JWT 必須。未ログインなら 401 で失敗。

=> 結果: 「新フローはセッション不整合で失敗」「旧フローは認証不足で失敗」の二重失敗状態。

### RC-3: 既知課題としてリポジトリ内に明記済み
- `ISSUES.md` でも、
  - Auth未有効（DEV_AUTH_BYPASS前提）
  - Storage+EF パイプラインが Auth 前提で未有効
  がクリティカル課題として明示されている。

## 構成の現状（コードベース上の事実）
- バックエンドAPIは `withApi` で認証をデフォルト必須化。
- Supabase Admin（service_role）はサーバ側で `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` 必須（本番）。
- Flutterは `API_BASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` を `--dart-define` で注入前提。
- しかし録音のセッション管理は「バックエンドセッション作成」と接続されていない。

## 「今すぐ手動で確認すべきこと」（原因を確定するための観測項目）

### A. Flutter実機ログで確認
1. 録音開始直後に `sessionId=<uuid>` が出ているか（ローカルUUID）。
2. 直後の `POST /api/segments` レスポンスが 404 になっているか。
3. 未ログイン時に `POST /api/transcribe` が 401 になっているか。

### B. バックエンドログで確認
1. `/api/segments` で `NotFoundError('Session', sessionId)` が出ているか。
2. `/api/transcribe` で `Authentication required` (401) が出ているか。

### C. Supabase 側で確認
1. Authユーザーが実際に存在し、Flutter側で `currentSession` が張れているか。
2. Storageバケット `audio-segments` が存在するか。
3. Edge Function `process-audio` が deploy 済みか。

## この調査の結論
音声が保存されない主因は「ネットワーク品質や一時的障害」ではなく、
**(1) 録音セッションIDがDBセッションと紐づかない設計不整合** と、
**(2) 認証を通さず録音画面に入れる実装状態** の2点が同時に成立していること。

この2点が解消されない限り、保存パイプラインは恒常的に失敗する。
