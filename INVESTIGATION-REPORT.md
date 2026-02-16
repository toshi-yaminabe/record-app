# 音声保存パイプライン 完全調査レポート

> 調査日: 2026-02-17
> 対象: record-app (Next.js 15 + Flutter + Supabase)
> 目的: 「録音が正しく保存されない」根本原因の網羅的特定

---

## 既知の根本原因（事前分析で確定済み）

### RC-1: セッションIDの発行元不整合（新フロー破綻）

| 項目 | 内容 |
|---|---|
| 重要度 | CRITICAL |
| 確率 | 100%（新フロー使用時） |
| 原因 | Flutter側は録音開始時にローカルUUIDで`sessionId`生成。しかし`POST /api/segments`の`createSegment()`は`sessions`テーブルに該当IDが存在しuserIdが一致することを必須チェック。録音フロー内で`POST /api/sessions`が一度も呼ばれていない。 |
| 影響 | 新フロー（Storage + Edge Function）のPENDINGセグメント作成が必ず404で失敗 |
| 確認方法 | Flutter実機ログで`POST /api/segments`のレスポンスが404か確認 |
| 対処方法 | 録音開始時（`RecordingNotifier.startRecording()`内）で`POST /api/sessions`を呼び、返却されたDB上のsessionIdを使用する |

### RC-2: 認証フロー無効化（両フロー影響）

| 項目 | 内容 |
|---|---|
| 重要度 | CRITICAL |
| 確率 | 100% |
| 原因 | `main.dart`でLoginPage分岐がコメントアウト。常にHomePage表示。未ログインで`currentUser == null`のため新フロー無効。旧フローは`withApi(requireAuth=true)`でBearer JWT必須。 |
| 影響 | 新フロー: `_isSupabaseReady()`→false→フォールバック。旧フロー: Authorization headerなし |
| 確認方法 | `main.dart:125-128`のコメントアウト行を確認。Flutter実機で`currentUser`がnullか確認 |
| 対処方法 | (短期) DEV_AUTH_BYPASSが有効なら旧フローは動作する。(長期) LoginPage分岐を有効化し、Supabase Auth導入 |
| **補足** | 調査で`DEV_AUTH_BYPASS=true`がVercel上で有効であることを確認済み（`GET /api/sessions`が200返却）。旧フローのauth自体は通過する可能性あり |

### RC-3: 既知課題としてISSUES.mdに記載済み

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 100% |
| 原因 | GitHub Issue #4（認証がモック）、#5（DB接続問題）が未解決のまま |
| 確認方法 | `ISSUES.md`および`gh issue list`で確認 |
| 対処方法 | 各Issueの個別対応 |

---

## エージェント調査結果

> 以下は各調査エージェントが独立に追記するセクション

---

### Agent 1: Flutter クライアント側調査

> 調査完了: 2026-02-17
> 調査範囲: recording_service.dart, background_recording_handler.dart, recording_provider.dart, transcribe_service.dart, main.dart, constants.dart, pending_transcribe_store.dart, transcribe_retry_service.dart, permission_service.dart, background_service_initializer.dart, authenticated_client.dart, auth_provider.dart, connectivity_monitor.dart, offline_queue_service.dart, device_id_service.dart, recording_panel.dart, AndroidManifest.xml
> 発見件数: 16件 (CRITICAL: 3, HIGH: 5, MEDIUM: 5, LOW: 3)

---

#### F-01: POST /api/sessions が呼ばれない（セッション未作成）

| 項目 | 内容 |
|---|---|
| 重要度 | CRITICAL |
| 確率 | 100%（新フロー使用時） |
| 原因 | `recording_service.dart:98` で `_uuid.v4()` によりローカルUUIDを生成し、それを sessionId としてBGサービスに渡す。しかし録音フロー全体の中で `POST /api/sessions` が一切呼ばれないため、DBの sessions テーブルにこのUUIDは存在しない。新フローの `_createPendingSegment()` (`transcribe_service.dart:205-246`) は `POST /api/segments` を呼び、サーバー側 `segment-service.js:50` で `prisma.session.findFirst({ where: { id: sessionId, userId } })` を実行。存在しないため `NotFoundError` で HTTP 404 失敗。 |
| 影響 | 新フロー（Storage + Edge Function）のPENDINGセグメント作成が必ず失敗。文字起こし結果がDBに保存されない。 |
| 確認方法 | Flutter実機ログで `POST /api/segments` のレスポンスが 404 であることを確認。 |
| 対処方法 | `RecordingNotifier.startRecording()` 内で録音開始前に `POST /api/sessions { deviceId }` を呼び出し、返却された `session.id` をBGサービスに渡す。 |

#### F-02: LoginPage分岐コメントアウトによる認証バイパス

| 項目 | 内容 |
|---|---|
| 重要度 | CRITICAL |
| 確率 | 100% |
| 原因 | `main.dart:124-128` で `authState.isAuthenticated ? HomePage() : LoginPage()` がコメントアウトされ、常に `HomePage()` が表示される。ユーザーは一度もログインせず、`Supabase.instance.client.auth.currentUser` は常に `null`。 |
| 影響 | `TranscribeService._isSupabaseReady()` (`transcribe_service.dart:21-27`) が常に `false` を返し、新フロー（Storage直接アップロード + Edge Function）は絶対に使われない。常に旧フロー `_transcribeViaMultipart()` にフォールバック。新フローの全コードがデッドコード。 |
| 確認方法 | `main.dart:125` のコメントアウトを確認。実機で `currentUser` が `null` であることをログ確認。 |
| 対処方法 | (短期) 旧フロー + `DEV_AUTH_BYPASS=true` で動作可能なため旧フロー問題を優先修正。(長期) LoginPage分岐復活 + Supabase Auth導入。 |

#### F-03: segmentNo の二重管理（BGハンドラ vs Provider）

| 項目 | 内容 |
|---|---|
| 重要度 | CRITICAL |
| 確率 | 95% |
| 原因 | BGハンドラ (`background_recording_handler.dart:102,156`) では `_segmentCount` をインクリメント後に `onSegmentCompleted` イベントで `segmentNo` を送信。しかし `SegmentCompleted` クラス (`recording_service.dart:208-222`) に `segmentNo` プロパティがなく、`RecordingService._segmentSub` (`recording_service.dart:42-52`) でもイベントデータの `segmentNo` フィールドを読み取っていない。Provider (`recording_provider.dart:147`) では `state.segmentCount + 1` で独自に採番し `_transcribeAndDelete` に渡す。BGハンドラとProviderの採番が独立しているためタイミングによってずれる。 |
| 影響 | サーバーに送信される `segmentNo` がBGハンドラの実際のカウントと不一致。旧フロー `POST /api/transcribe` の `upsert` で `sessionId_segmentNo` 複合キーにより意図しないレコード上書きまたは欠番が発生。 |
| 確認方法 | BGハンドラログの `segmentNo=$_segmentCount` と `_transcribeAndDelete` に渡される `segmentNo` を比較。 |
| 対処方法 | `SegmentCompleted` に `segmentNo` プロパティを追加し、`RecordingService._segmentSub` でBGから送信された値を読み取る。Provider側はそのまま使用。独自カウントは表示用のみに限定。 |

#### F-04: SegmentCompleted イベントの segmentNo 未伝達

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 90% |
| 原因 | `background_recording_handler.dart:104-111` で `onSegmentCompleted` イベントに `'segmentNo': _segmentCount` を含めて送信しているが、`recording_service.dart:42-52` の `_segmentSub` リスナーでは `event['segmentNo']` を読み取らない。`SegmentCompleted` クラスに `segmentNo` プロパティがないため、BGハンドラが正確に管理している番号がProvider側に届かない。 |
| 影響 | F-03 と同根。正確なsegmentNoがTranscribeServiceに渡されず、DB上のセグメント番号がBG側の実態と乖離。 |
| 確認方法 | `SegmentCompleted` のフィールドに `segmentNo` が存在しないことを確認。 |
| 対処方法 | `SegmentCompleted` クラスに `final int segmentNo` を追加。`RecordingService._segmentSub` で `event['segmentNo'] as int` を読み取りコンストラクタに渡す。`RecordingNotifier._onEvent` で `event.segmentNo` を使用。 |

#### F-05: 旧フローの Authorization ヘッダー欠落

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 70%（DEV_AUTH_BYPASS無効時は100%） |
| 原因 | `transcribe_service.dart:156-163` の旧フロー `_transcribeViaMultipart()` で、Authorizationヘッダーを付与しようとするが、F-02 により `currentSession` は常に `null`。ヘッダーは付与されない。サーバー側 `middleware.js:109` で `DEV_AUTH_BYPASS=true` なら `mock-user-001` で認証通過。`DEV_AUTH_BYPASS` 無効化で全リクエスト401拒否。 |
| 影響 | `DEV_AUTH_BYPASS=true` の間は問題ないが、無効化すると旧フローも完全に停止。 |
| 確認方法 | Vercel環境変数で `DEV_AUTH_BYPASS` を確認。Flutter実機ログで `POST /api/transcribe` のレスポンスコード確認。 |
| 対処方法 | (短期) `DEV_AUTH_BYPASS=true` 維持。(長期) Supabase Auth導入後に正規JWT付与。 |

#### F-06: BGサービス ready ハンドシェイクの 5秒タイムアウト

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 30%（低スペック端末・初回起動時） |
| 原因 | `recording_service.dart:121-127` で BGサービスの `ready` イベントを5秒以内に待機。`background_recording_handler.dart:43` の `service.invoke('ready')` は `onStart` の末尾で発火。Android 12+ のフォアグラウンドサービス起動は通知チャネル作成・マイクtype宣言等で時間がかかる場合がある。特に初回起動やDoze Mode復帰直後は5秒では不足する可能性。 |
| 影響 | `RecordingException('バックグラウンドサービスの起動がタイムアウトしました')` スロー。録音開始不能。SnackBar表示。 |
| 確認方法 | 実機ログで `startRecording: waiting for ready handshake` の後5秒以内に `ready received` が出るか確認。 |
| 対処方法 | タイムアウトを10秒に延長。または `ready` 未着時にリトライ（BGサービス再起動 + 再待機）追加。 |

#### F-07: セグメントファイルのレースコンディション

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 20% |
| 原因 | `background_recording_handler.dart:148-175` の `_onSegmentTimeout()` で `_recorder.stop()` 後に `_startNewSegment()` を呼ぶが、stop/start の間にUI側から `stopRecording()` が呼ばれるとレースコンディション発生。`_isRecording` チェック (line 149) はtimeout開始時点の値であり、`_recorder.stop()` のawait中に `stopRecording()` が `_isRecording = false` に設定した場合、`_startNewSegment()` が不整合状態で実行される。また `_recorder.stop()` の戻り値pathと `_currentSegmentPath` の一致は保証されない（recordライブラリ実装依存）。 |
| 影響 | ファイルパスの不一致でTranscribeServiceに渡されるファイルが実在しない可能性。stop/start間のレースで二重停止やnull参照。 |
| 確認方法 | ログで `segment completed path=$path` の値を確認。10分境界で停止操作を行いクラッシュ有無を確認。 |
| 対処方法 | `_onSegmentTimeout()` にミューテックス的フラグ `_isProcessingSegment` を追加して排他制御。`_recorder.stop()` のawait後にも `_isRecording` を再チェック。 |

#### F-08: 旧フロー userId 不一致 (mock-user-001 問題)

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 80%（Auth導入時に顕在化） |
| 原因 | `DEV_AUTH_BYPASS=true` 時のサーバー側 `userId` は `mock-user-001` (`middleware.js:15`)。Supabase Auth導入後はSupabase Auth UUIDになる。DBの `mock-user-001` 所有データが新しいuserIdでは見つからない。複数端末で同一 `mock-user-001` としてアクセスするとデータ混在。 |
| 影響 | Auth移行時にデータ所有権不整合。複数端末使用でセッション混在。 |
| 確認方法 | `middleware.js` の `DEV_AUTH_BYPASS` 分岐と `MOCK_DEV_USER_ID` 確認。 |
| 対処方法 | Auth導入時にデータマイグレーション計画策定。 |

#### F-09: PendingTranscribeStore のリトライが根本原因未解決で永続失敗

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 100%（F-01/F-03未修正時） |
| 原因 | `recording_provider.dart:196-206` で文字起こし失敗時に `_pendingStore.add()` でリトライキュー追加。`transcribe_retry_service.dart:52-60` でリトライ時に同じエラーで永遠に失敗。`maxRetryCount=5` で dead_letter 化するがファイルは削除されずストレージ圧迫。dead_letter にUI上のリカバリ手段なし。 |
| 影響 | リトライキューが無限にエラーを繰り返し dead_letter 蓄積。ローカル音声ファイルがディスク圧迫。 |
| 確認方法 | `pending_transcribes.db` の dead_letter 件数確認。 |
| 対処方法 | (短期) F-01, F-05修正で根本解消。(中期) dead_letter件数をUIに表示しユーザーが手動リトライ/クリア可能に。(長期) 4xx永久エラー判別で即dead_letter化。 |

#### F-10: 録音ディレクトリ未設定の検出タイミング

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 5% |
| 原因 | `recording_service.dart:100-105` で `SharedPreferences` から `recordings_dir` を読み取り、空なら例外スロー。`main.dart:67-70` で起動時にセットされるが、アプリデータクリアで空になる。 |
| 影響 | 録音開始時に「録音ディレクトリが設定されていません」エラー。録音不能。 |
| 確認方法 | 設定 > アプリ > データ消去後に録音開始を試みる。 |
| 対処方法 | `recordings_dir` が空の場合、フォアグラウンド側で `getApplicationDocumentsDirectory()` を再取得してフォールバック。 |

#### F-11: BGサービス停止後のイベントリスナー管理

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 40% |
| 原因 | `recording_service.dart:64` で録音停止後に `_service.invoke('stopService')` を呼びBGサービス停止。しかし `_listenToServiceEvents()` で登録した4つのStreamSubscriptionはキャンセルされない。次の録音開始時にBGサービス再起動すると、`FlutterBackgroundService` の `on()` がサービス再起動をまたいでリスナーを維持するかはライブラリ実装に依存。二重リスナー登録で同一イベントが2回処理される可能性。 |
| 影響 | 2回目以降の録音で `_transcribeAndDelete` が同一セグメントに2回呼ばれる可能性。segmentCount倍増、APIへの重複送信。 |
| 確認方法 | 録音開始→停止→開始→停止を繰り返しsegmentCount異常増加を確認。 |
| 対処方法 | `RecordingService` がアプリライフサイクル中1インスタンスのみ生成されることをRiverpodのProvider設計で保証。 |

#### F-12: API_BASE_URL ビルド時注入のデバッグ時問題

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 60%（開発時のみ） |
| 原因 | `constants.dart:25-28` で `String.fromEnvironment('API_BASE_URL', defaultValue: '')` 使用。`--dart-define-from-file=env/prod.json` 忘れで空文字。`main.dart:37-45` で空文字チェック。`env/prod.json` には正しいURL設定済み。 |
| 影響 | `--dart-define-from-file` 忘れの場合のみ発生。正しくビルドすれば問題なし。 |
| 確認方法 | `flutter run` コマンドに `--dart-define-from-file=env/prod.json` が含まれているか確認。 |
| 対処方法 | Makefile / VSCode launch.json に設定含める。 |

#### F-13: Android バッテリー最適化 / Doze Mode の影響

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 50%（長時間録音時） |
| 原因 | `AndroidManifest.xml` で `WAKE_LOCK` パーミッション宣言済みだが、`background_recording_handler.dart` 内で実際に `WakeLock` を取得するコードがない。`flutter_background_service` の `isForegroundMode: true` で前面サービスとして動作するが、Android 12+ のバッテリー最適化適用時はフォアグラウンドサービスでもCPU制限がかかる場合がある。 |
| 影響 | 長時間録音でセグメントタイマー遅延。最悪の場合 `AudioRecorder` がシステムに停止させられ録音データ消失。 |
| 確認方法 | バッテリー設定「制限なし」vs「最適化」で30分以上録音しセグメント時間比較。 |
| 対処方法 | (1) `WakeLock` 取得コードをBGハンドラに追加。(2) バッテリー最適化除外を促すダイアログ表示。 |

#### F-14: 録音フォーマットのサーバー互換性

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 10% |
| 原因 | `background_recording_handler.dart:131-136` で `AudioEncoder.aacLc`, `sampleRate: 16000`, `bitRate: 64000`、拡張子 `.m4a`。Flutter側は `MediaType('audio', 'mp4')` で送信。サーバー側 `ALLOWED_MIME` に `audio/mp4` 含む。互換性あり。 |
| 影響 | 現状は問題なし。 |
| 確認方法 | 実機ログで `POST /api/transcribe` のステータスコード確認。 |
| 対処方法 | 現状対応不要。 |

#### F-15: RecordingPanel の状態同期 (invalidate) による状態リセット

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 15% |
| 原因 | `recording_panel.dart:40-43` で `didChangeAppLifecycleState(resumed)` から `ref.invalidate(recordingNotifierProvider)` を呼ぶ。Provider完全再構築で `segmentCount`, `transcribedCount`, `lastTranscript` がリセット。`RecordingService` は別Provider管理のためBG通信は維持。 |
| 影響 | フォアグラウンド復帰時にUIのカウント表示がリセット。録音自体は継続。 |
| 確認方法 | 録音中にバックグラウンドにし10秒後にフォアグラウンド復帰。カウントリセット確認。 |
| 対処方法 | `invalidate()` 代わりに `RecordingNotifier` に `syncFromBackground()` メソッド追加。 |

#### F-16: ConnectivityMonitor のリトライが根本原因未解決で空回り

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 30% |
| 原因 | `main.dart:91-95` で `ConnectivityMonitor` に `transcribeRetryService` を渡し、オフライン→オンライン復帰時に `retryPending()` 呼び出し。根本原因未修正なら無限失敗。`connectivity_monitor.dart:67-71` の try-catch でエラーはログ記録のみ。 |
| 影響 | オフライン復帰のたびにリトライ走り全件失敗。`_isRetrying` フラグで並行実行は防止。 |
| 確認方法 | 機内モード ON→OFF 後のログで `transcribe retry` の成否確認。 |
| 対処方法 | F-01, F-05修正でリトライ成功するようになる。追加対策として `GET /api/health` プレフライトチェック。 |

---

#### 調査サマリー（優先度順）

| 優先 | ID | タイトル | 重要度 | 確率 |
|---|---|---|---|---|
| 1 | F-01 | POST /api/sessions 未呼び出し | CRITICAL | 100% |
| 2 | F-02 | LoginPage コメントアウト | CRITICAL | 100% |
| 3 | F-03 | segmentNo 二重管理 | CRITICAL | 95% |
| 4 | F-04 | SegmentCompleted の segmentNo 未伝達 | HIGH | 90% |
| 5 | F-08 | 旧フロー userId 不一致 (mock-user-001) | HIGH | 80% |
| 6 | F-05 | 旧フロー Authorization ヘッダー欠落 | HIGH | 70% |
| 7 | F-09 | PendingTranscribeStore の永続エラーリトライ | MEDIUM | 100% |
| 8 | F-13 | Android バッテリー最適化 / Doze Mode | MEDIUM | 50% |
| 9 | F-11 | BGサービスイベントリスナー管理 | MEDIUM | 40% |
| 10 | F-06 | BGサービス ready ハンドシェイク 5秒タイムアウト | HIGH | 30% |
| 11 | F-07 | セグメントファイルレースコンディション | HIGH | 20% |
| 12 | F-16 | ConnectivityMonitor リトライ空回り | LOW | 30% |
| 13 | F-15 | RecordingPanel invalidate 状態リセット | LOW | 15% |
| 14 | F-14 | 録音フォーマット互換性 | LOW | 10% |
| 15 | F-10 | 録音ディレクトリ未設定 | MEDIUM | 5% |
| 16 | F-12 | API_BASE_URL ビルド時注入 | MEDIUM | 60%（開発時のみ） |

---

#### 現在の動作フロー分析（旧フロー: DEV_AUTH_BYPASS=true 時）

```
[Flutter] 録音ボタン押下
  -> RecordingNotifier.startRecording()
    -> deviceId 空チェック OK
    -> RecordingService.startRecording()
      -> PermissionService.requestRecordingPermissions() -> OK
      -> sessionId = UUID.v4() （ローカル生成、DBに存在しない）
      -> SharedPreferences から recordings_dir 取得
      -> BGサービス起動 -> ready ハンドシェイク（5秒タイムアウト）
      -> BGサービスに 'start' { sessionId, recordingsDir } 送信

[BG Service] start 受信
  -> _BackgroundRecordingHandler.startRecording()
    -> _recorder.start() で .m4a ファイル作成開始
    -> 10分タイマー開始
    -> 'onRecordingStarted' { sessionId } を UI に送信

[10分経過 or 停止操作]
  -> _recorder.stop() -> ファイル確定
  -> 'onSegmentCompleted' { sessionId, filePath, ..., segmentNo } を UI に送信

[Flutter UI] onSegmentCompleted 受信
  -> RecordingNotifier._onEvent(SegmentCompleted)
    -> state.segmentCount + 1 （BGの segmentNo とは別採番 ... F-03/F-04）
    -> _transcribeAndDelete()
      -> TranscribeService.transcribe()
        -> _isSupabaseReady() -> false （未ログイン ... F-02）
        -> _transcribeViaMultipart() （旧フロー）
          -> POST /api/transcribe { audio, deviceId, sessionId, segmentNo, ... }
          -> Authorization header なし（currentSession == null ... F-05）
          -> サーバー: DEV_AUTH_BYPASS -> userId=mock-user-001
          -> サーバー: deviceIdでACTIVEセッション検索 -> なければ自動作成
          -> サーバー: segment upsert -> OK（sessionIdはDB側のものを使用）
          -> 200 { segment: { id, sessionId(DB), segmentNo, text } }
        -> 成功: ローカルファイル削除、lastTranscript 更新
        -> 失敗: PendingTranscribeStore に追加 ... F-09
```

**結論**: 旧フロー + `DEV_AUTH_BYPASS=true` の組み合わせでは、F-01 の影響は受けない（旧フローはリクエストの sessionId を無視し、deviceId でセッションを自動管理するため）。**録音が保存されない主な原因候補（Flutter起因）:**

1. **F-06 (30%)**: BGサービスの ready タイムアウトで録音自体が開始されない
2. **F-03/F-04 (95%)**: segmentNo 不整合で upsert の上書き/欠番
3. **F-13 (50%)**: Doze Mode で長時間録音が中断される
4. **F-07 (20%)**: セグメント境界でのレースコンディション
5. **バックエンド起因 (B-04/B-05)**: Gemini タイムアウトまたはAPIエラーで500応答

---

### Agent 2: Vercel バックエンド調査

> 調査完了: 2026-02-17
> 調査範囲: lib/middleware.js, app/api/transcribe/route.js, app/api/segments/route.js, app/api/sessions/route.js, lib/services/segment-service.js, lib/services/session-service.js, lib/gemini.js, lib/prisma.js, lib/supabase.js, lib/errors.js, lib/constants.js, lib/rate-limit.js, next.config.mjs, vercel.json, prisma/schema.prisma, lib/crypto.js, flutter_app/lib/services/transcribe/transcribe_service.dart, flutter_app/lib/data/repositories/authenticated_client.dart, flutter_app/lib/core/constants.dart

---

#### B-01: DEV_AUTH_BYPASS がVercel本番で有効 → 全リクエストが mock-user-001 で処理される

| 項目 | 内容 |
|---|---|
| 重要度 | CRITICAL |
| 確率 | 100% |
| 原因 | `lib/middleware.js:109` で `process.env.DEV_AUTH_BYPASS === 'true'` の場合、`NODE_ENV` チェックなしに即座に `MOCK_DEV_USER_ID = 'mock-user-001'` を返す。Vercel環境変数にも `DEV_AUTH_BYPASS=true` が設定されているため（GET /api/sessions の200応答で確認済み）、本番環境で全APIが mock-user-001 として動作する。コード上 `authenticateUser()` は `DEV_AUTH_BYPASS` を最初にチェックし、trueなら Bearer token の有無にかかわらず即座にreturnする。 |
| 影響 | (1) Flutter側がSupabase JWTを送信しない状態でも認証を通過する（旧フローが動く前提条件）。(2) しかし全データが `mock-user-001` に紐づくため、将来Supabase Auth導入時にデータ移行が必要。(3) 同じVercel instanceにアクセスする全ユーザーが同一ユーザーとして扱われる。 |
| 確認方法 | Vercel Dashboard > Settings > Environment Variables で `DEV_AUTH_BYPASS` の値を確認 |
| 対処方法 | (短期) 現状の動作確認が目的ならこのまま維持。(長期) Supabase Auth導入（Issue #41）後に `DEV_AUTH_BYPASS` を削除 |

---

#### B-02: 旧フロー（POST /api/transcribe）のformDataパースがVercel serverlessで正常動作するか

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 30% |
| 原因 | `app/api/transcribe/route.js:19` で `request.formData()` を使用。Next.js 15 の App Router は Web API 標準の `Request.formData()` をサポートしているが、Vercel serverless 環境では (1) ファイルサイズが大きい場合にメモリ制限（Lambda: デフォルト1024MB）に達する可能性がある。(2) `formData()` は全データをメモリに読み込むため、audioFile + base64変換（`audioBuffer.toString('base64')` in gemini.js:51）で音声データが3回メモリに存在する（原ファイル、ArrayBuffer、base64文字列）。6MBの音声ファイルの場合、base64で約8MB、合計約22MBのメモリ使用。`next.config.mjs` の `bodySizeLimit: '10mb'` は Server Actions 用であり、Route Handler の formData には適用されない。 |
| 影響 | 大きな音声ファイル（4-6MB）でメモリ不足エラーの可能性。エラーは500として返却され、詳細は `handleApiError` の `console.error` にのみ出力される。 |
| 確認方法 | Vercel Function Logs で `POST /api/transcribe` の実行時エラーを確認。小さいファイル（100KB以下）で動作確認し、段階的にサイズを増加させる。 |
| 対処方法 | (1) `vercel.json` で transcribe 関数のメモリ設定を明示的に増加: `"memory": 1024`。(2) Storage + Edge Function への移行を完了する（Issue #42） |

---

#### B-03: bodySizeLimit の適用範囲の誤解

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 40% |
| 原因 | `next.config.mjs:11-13` で `experimental.serverActions.bodySizeLimit: '10mb'` が設定されているが、これは **Server Actions** 専用の設定であり、**Route Handlers** (`app/api/*/route.js`) には適用されない。Vercel serverless の Route Handler に対するボディサイズ制限は Vercel プラットフォーム側のデフォルト（4.5MB for Hobby, 100MB for Pro）に依存する。`transcribe/route.js:31` のアプリ側バリデーションは `MAX_AUDIO_SIZE = 6MB` だが、Vercel Hobby プランの場合、4.5MB制限でリクエスト自体が拒否される可能性がある。 |
| 影響 | Hobby プランの場合、4.5MB超の音声ファイルが Vercel レベルで 413 エラー。Pro プランなら問題なし。 |
| 確認方法 | Vercel Dashboard でプランを確認。4.5MB超のファイルを `POST /api/transcribe` に送信してレスポンスを確認。 |
| 対処方法 | (1) Pro プランなら対応不要。(2) Hobby プランなら `MAX_AUDIO_SIZE` を 4MB に下げる。(3) Storage + Edge Function 移行で根本解決。 |

---

#### B-04: Gemini STT タイムアウトリスク（Vercel 60秒 vs Gemini処理時間）

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 50% |
| 原因 | `vercel.json` で `app/api/transcribe/route.js` に `maxDuration: 60` を設定。しかし `lib/gemini.js:53` の `model.generateContent()` 呼び出しにはタイムアウト設定がない。Gemini API の処理時間は音声ファイルのサイズ・内容に依存し、10分セグメント（`AppConstants.segmentDurationMinutes = 10`）の場合、6MB近い音声データの文字起こしに30-60秒以上かかる可能性がある。加えて、Vercel の cold start（5-10秒）+ formData パース + base64エンコード + Gemini API 呼び出し の合計が60秒を超えるケースが想定される。 |
| 影響 | 60秒超過でVercelが504 Gateway Timeoutを返却。Flutter側はタイムアウト60秒（`transcribe_service.dart:178`）で独自のタイムアウト処理。サーバー側でGemini処理が途中で打ち切られるが、Prismaのupsertは実行されないため**データ不整合は起きない**（セグメントが作成されないだけ）。ただし、ユーザーの音声データは失われる。 |
| 確認方法 | Vercel Function Logs で `POST /api/transcribe` の実行時間を確認。10分セグメントの処理時間分布を測定。 |
| 対処方法 | (1) `lib/gemini.js` に `AbortController` + タイムアウト（45秒）を追加し、タイムアウト時は明確なエラーを返す。(2) Storage + Edge Function 移行（Edge Function は300秒タイムアウト）。(3) Flutter側でリトライロジックを強化。 |

---

#### B-05: Gemini STT 呼び出しのエラーハンドリング不備

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 35% |
| 原因 | `lib/gemini.js:53-63` の `transcribeAudio()` で `model.generateContent()` の呼び出しに try-catch がない。Gemini API のエラー（APIキー無効、レート制限、モデル不存在、不正なMIMEタイプ等）は生の `Error` として throw される。これは `middleware.js:93-95` の catch で捕捉されるが、`handleApiError()` では `AppError` でもPrismaエラーでもないため、`console.error` + 500応答になる。エラーメッセージが `'Internal server error'` となり、Flutter側で原因特定が困難。また、`result.response.text()` が空文字列を返す場合（Gemini が文字起こし不能と判断した場合）のハンドリングもない。空のテキストがそのままセグメントに保存される。 |
| 影響 | (1) Gemini API エラー時、500レスポンスの汎用メッセージのみ。(2) 空文字の文字起こし結果がDBに保存される。(3) Flutter側のオフラインキューがリトライし続ける可能性。 |
| 確認方法 | `GEMINI_API_KEY` を一時的に無効化して `/api/transcribe` を呼び出し、エラーレスポンスを確認。Vercel Logsでエラー詳細を確認。 |
| 対処方法 | (1) `transcribeAudio()` 内に try-catch を追加し、`AppError` でラップして適切なHTTPステータス（502 Bad Gateway 等）を返す。(2) 空文字結果のバリデーション追加。(3) Gemini レスポンスの `response.promptFeedback` をチェックし、安全性フィルタ等の拒否理由を返す。 |

---

#### B-06: 旧フロー — formData の sessionId が使われていない

| 項目 | 内容 |
|---|---|
| 重要度 | CRITICAL |
| 確率 | 95% |
| 原因 | `app/api/transcribe/route.js:22` で `formData.get('sessionId')` を取得し、27行目のバリデーションで必須チェックしているが、42-51行目のセッション検索ロジックでは `deviceId` + `userId` + `SESSION_STATUS.ACTIVE` でDBを検索し、`sessionId` は**完全に無視**されている。Flutter側が送信する `sessionId`（ローカルUUID）はDBに存在しないため、findFirst は null を返し、新しいセッションが `prisma.session.create()` で作成される。つまり、旧フローは**毎回新しいセッションを作成する可能性がある**（既存のACTIVEセッションがない場合）。また、53行目の upsert の `sessionId_segmentNo` 複合ユニークキーには `session.id`（DB発行のcuid）が使われるため、Flutter側の `sessionId` との対応が完全に切れている。 |
| 影響 | (1) Flutter側が認識するsessionIdとDB上のsessionIdが異なる。(2) セグメント一覧取得（`GET /api/transcribe?sessionId=xxx`）でFlutter側のsessionIdを使うとヒットしない。(3) セッションが重複作成される可能性。ただし、旧フローで `findFirst` が既存ACTIVEセッションを見つければ再利用されるため、同じdeviceIdからの連続リクエストなら1セッションに集約される。 |
| 確認方法 | Vercel Logsで `POST /api/transcribe` 後に `GET /api/transcribe?sessionId=xxx`（Flutterが送信したsessionId）を試し、空配列が返るか確認。DBの sessions テーブルで重複セッションを確認。 |
| 対処方法 | (1) 旧フローを修正し、Flutter側のsessionIdではなくDB上のsessionIdをレスポンスに含める（現在 `segment.sessionId` で返却しているが、Flutterがこれを利用しているか確認）。(2) 根本的には新フローに移行し、セッション作成を明示的に行う。 |

---

#### B-07: セッション作成時の publishedVersion 検索がクエリエラーを起こす可能性

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 20% |
| 原因 | `lib/services/session-service.js:19-22` で `prisma.publishedVersion.findFirst({ where: { ruleTree: { userId } } })` を実行している。`mock-user-001` に対する RuleTree が存在しない場合、`findFirst` は null を返す。しかし、seed.mjs でデフォルト分人とルールツリーが作成されている前提なので、seed 未実行の本番環境では `latestVersion` が常に null になり、`ruleVersionId: null` でセッションが作成される。これ自体はエラーにはならない（nullable フィールド）が、ルールツリー機能が無効化される。 |
| 影響 | セッション作成自体は成功するが、分人自動割り当て機能が無効。録音保存パイプラインへの直接影響は小さい。 |
| 確認方法 | DBの `sessions` テーブルで `rule_version_id` が null のレコードを確認。 |
| 対処方法 | seed.mjs を本番DBに対して実行するか、publishedVersion が存在しない場合の明示的なログ出力を追加。 |

---

#### B-08: PrismaClient のコネクションプーリング（Serverless環境）

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 25% |
| 原因 | `lib/prisma.js` は `new PrismaClient()` をグローバルにキャッシュする標準パターンを使用しているが、`@prisma/adapter-neon` 等のサーバレス向けアダプタを使用していない。`package.json` にも `@neondatabase/serverless` や `@prisma/adapter-neon` の依存がない。`.env.example` の `DATABASE_URL` には `?pgbouncer=true&connection_limit=1&statement_cache_size=0` が付与されており、PgBouncer は Supabase 側で提供されている。しかし、Vercel serverless の各 Lambda インスタンスが独立に `PrismaClient` を生成し、cold start 毎に新しいコネクションを張る。PgBouncer の connection limit を超過すると `"too many connections"` エラーが発生する。 |
| 影響 | 同時リクエスト数が多い場合にDB接続エラー。散発的な500エラーとして現れる。ただし、現在の使用量（開発段階・単一ユーザー）では顕在化しにくい。 |
| 確認方法 | Vercel Function Logs で `P1001` (Can't reach database server) や `P1002` (connection timed out) エラーを検索。Supabase Dashboard > Database > Connections で同時接続数を確認。 |
| 対処方法 | (1) `@prisma/adapter-neon` + `@neondatabase/serverless` を導入し、HTTP接続またはWebSocket接続に変更。(2) `connection_limit=1` を維持し、PgBouncer に接続管理を委任。(3) Prisma の `pool_timeout` 設定を明示。 |

---

#### B-09: レートリミット（10req/min for transcribe）がパイプラインを阻害する可能性

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 60% |
| 原因 | `app/api/transcribe/route.js:84` で `rateLimit: { requests: 10, window: '1 m' }` が設定されている。10分セグメント録音の場合、1分間に1リクエストなので問題ない。しかし、オフラインキュー（`flutter_app/lib/services/offline/`）が溜まったセグメントを一斉にリプレイする場合、短時間に10件以上のリクエストが発生し、429 Rate Limit Exceeded を受ける。`lib/rate-limit.js` で Upstash Redis 未設定の場合はレートリミットがスキップされる（`return { success: true }`）。Vercel本番に Upstash Redis が設定されているかどうかが分岐点。 |
| 影響 | Upstash Redis 設定済みの場合: オフラインキューの一斉リプレイで429エラー。Flutter側のリトライロジックが指数バックオフで再試行するが、完全復旧まで時間がかかる。Upstash Redis 未設定の場合: レートリミット無効で問題なし。 |
| 確認方法 | Vercel Dashboard > Environment Variables で `UPSTASH_REDIS_REST_URL` の設定有無を確認。設定済みの場合、Flutter実機でオフラインモードから復帰し、一斉送信で429が出るか確認。 |
| 対処方法 | (1) `transcribe` のレートリミットを `30req/min` に引き上げる。(2) オフラインキューのリプレイにインターバル（1秒間隔等）を追加。(3) 429応答時のRetry-Afterヘッダーを返却し、Flutter側で尊重する。 |

---

#### B-10: Vercel Serverless のコールドスタート影響

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 40% |
| 原因 | Vercel serverless はリクエストがない場合にインスタンスを停止する。コールドスタート時の初期化処理: (1) PrismaClient 生成 + DB接続確立（2-5秒）、(2) `@google/generative-ai` モジュールロード、(3) `@upstash/ratelimit` の動的import（`rate-limit.js:10-18`）、(4) `@supabase/supabase-js` のクライアント生成。これらの合計が5-10秒。`vercel.json` の `maxDuration: 60` には含まれるが、Flutter側のタイムアウト（60秒）との余裕が小さくなる。 |
| 影響 | コールドスタート + Gemini処理で合計55-65秒かかる場合、Vercel 60秒タイムアウトまたはFlutter 60秒タイムアウトに達する。朝の初回リクエスト（数時間放置後）が最も影響を受けやすい。 |
| 確認方法 | Vercel Function Logs で `Duration` と `Init Duration` を確認。Init Duration が5秒以上のケースを特定。 |
| 対処方法 | (1) Vercel Cron で定期的にヘルスチェックを叩いてインスタンスを温めておく。(2) Pro プランなら `maxDuration` を120-300秒に設定。(3) Edge Function 移行でコールドスタート解消。 |

---

#### B-11: CORS設定なし — モバイルアプリからのリクエスト

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 5% |
| 原因 | プロジェクト全体で `Access-Control-Allow-Origin` 等のCORS関連ヘッダーが一切設定されていない。ミドルウェア（`app/middleware.ts` / `middleware.js`）も存在しない。Next.js の Route Handler はデフォルトで CORS ヘッダーを返さない。 |
| 影響 | **Flutter（ネイティブ HTTP）からのリクエストには影響なし**。ネイティブアプリはブラウザのSame-Origin Policyに縛られない。**ただし、Web ブラウザからのAPI呼び出し**（例: Next.js の SSR/CSR から同一オリジンのAPIを叩く場合は問題なし。外部ドメインからのAPIアクセスはブロックされる）。 |
| 確認方法 | Flutter実機からのAPI呼び出しが正常なら問題なし。Web版からクロスオリジンリクエストが必要な場合のみ検証。 |
| 対処方法 | 現時点ではFlutterアプリ専用のため対応不要。将来Webクライアントを別ドメインで運用する場合、Next.js middleware でCORSヘッダーを追加。 |

---

#### B-12: upsert の複合ユニーク制約 — segmentNo の整数バリデーション

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 15% |
| 原因 | `app/api/transcribe/route.js:23` で `parseInt(formData.get('segmentNo') \|\| '0', 10)` を使用。`formData.get('segmentNo')` が `null` / `undefined` / 空文字の場合、`'0'` がデフォルトになる。しかし、複数セグメントが全て `segmentNo=0` として送信された場合、upsert の `sessionId_segmentNo` ユニーク制約により**後続のセグメントが先行セグメントを上書き**する。`app/api/segments/route.js:27` では `segmentNo === undefined \|\| segmentNo === null` のバリデーションがあるが、`0` は通過する。Flutter側が正しい segmentNo を送信しているか、また segmentNo のインクリメントロジックが正しいかに依存する。 |
| 影響 | segmentNo が重複した場合、先行セグメントのテキストが上書きされ、音声データが失われる。 |
| 確認方法 | DBの segments テーブルで同一 sessionId に対する segmentNo の分布を確認。segmentNo=0 が複数存在するか確認。 |
| 対処方法 | (1) segmentNo のバリデーションを強化（0以上の整数であること + 同一セッション内でのインクリメント検証）。(2) upsert ではなく create + conflict 時の明示的エラー返却に変更し、クライアントにリトライ判断を委ねる。 |

---

#### B-13: Gemini APIキーの取得優先順位 — DB保存キー経由の遅延

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 10% |
| 原因 | `lib/gemini.js:11-35` の `getGeminiClient()` は、(1) 環境変数 `GEMINI_API_KEY` → (2) DB保存キー（`prisma.userSettings.findUnique()`）の優先順で検索する。環境変数にキーが設定されていれば即座に返却されるが、未設定の場合はDBアクセスが追加発生する。`DEV_AUTH_BYPASS` 環境下では `userId = 'mock-user-001'` のため、`userSettings` テーブルにこのユーザーのレコードがなければ null が返り、`'GEMINI_API_KEY is not configured'` エラーで throw される。このエラーは `AppError` ではなく通常の `Error` なので、500レスポンスになる。 |
| 影響 | `GEMINI_API_KEY` 環境変数が設定されていれば問題なし（ヘルスチェックで `gemini: true` が確認済みなので、環境変数は設定されている可能性が高い）。 |
| 確認方法 | `/api/health` のレスポンスで `gemini: true` を確認（確認済み）。 |
| 対処方法 | 対応不要（環境変数設定済みのため）。ただし、エラーメッセージの改善として `AppError('GEMINI_API_KEY is not configured', 503)` に変更することを推奨。 |

---

#### B-14: ENCRYPTION_KEY 未設定時の本番エラー

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 5% |
| 原因 | `lib/crypto.js:18-19` で `NODE_ENV === 'production'` かつ `ENCRYPTION_KEY` 未設定の場合、`throw new Error('ENCRYPTION_KEY must be set in production environment')` が発生する。この関数は `getGeminiClient()` 内の `decrypt(settings.geminiApiKey)` 経由でのみ呼ばれ、環境変数にGEMINI_API_KEY が設定されていれば呼ばれない。しかし、将来的にユーザー設定経由のAPIキーを使用する場合に問題になる。 |
| 影響 | 現在の構成（環境変数でGEMINI_API_KEY設定済み）では影響なし。 |
| 確認方法 | `ENCRYPTION_KEY` の設定有無を確認。 |
| 対処方法 | 対応不要（現時点）。Supabase Auth 導入後、ユーザー固有のGemini APIキー機能を使う場合に設定。 |

---

#### B-15: 旧フロー — セッション自動作成のdeviceId + userId検索の正当性

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 70% |
| 原因 | `app/api/transcribe/route.js:42-45` で `prisma.session.findFirst({ where: { deviceId, userId, status: SESSION_STATUS.ACTIVE } })` を実行。`DEV_AUTH_BYPASS` 下では `userId = 'mock-user-001'` が固定。`deviceId` は Flutter側の `SharedPreferences` で永続化されたUUID。問題は以下: (1) 複数デバイスから同じユーザーがアクセスする場合、デバイスごとに別セッションが作成される（これは正しい動作）。(2) **同一デバイスで複数のACTIVEセッションが存在する場合は `orderBy: { startedAt: 'desc' }` で最新を取得する**（これも正しい）。(3) しかし、**セッションを明示的に STOPPED にしない限り、過去のACTIVEセッションが永続する**。Flutter側の `completeSession()` が正常に呼ばれないケース（アプリ強制終了等）では、古いACTIVEセッションが残存し、新しいリクエストがそこに紐づけられる可能性がある。 |
| 影響 | 古いACTIVEセッションにセグメントが追加され続ける。1つのセッションに大量のセグメントが蓄積する。日付をまたいだセッションが発生し、日次サマリー生成のスコープが不正確になる。 |
| 確認方法 | DBの sessions テーブルで `status = 'ACTIVE'` かつ `startedAt` が24時間以上前のレコードを検索。 |
| 対処方法 | (1) `findFirst` の条件に `startedAt` の日付制限（当日のみ）を追加。(2) Cron ジョブで24時間以上経過したACTIVEセッションを自動STOPPEDにする。(3) Flutter側のアプリ再起動時に古いセッションを完了させるロジックを追加。 |

---

#### B-16: Vercel serverless のタイムアウト設定が transcribe のみ

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 20% |
| 原因 | `vercel.json` で `maxDuration: 60` が設定されているのは `app/api/transcribe/route.js` と `app/api/proposals/route.js` のみ。`app/api/segments/route.js` と `app/api/sessions/route.js` はデフォルトタイムアウト（Hobby: 10秒、Pro: 15秒）。segments の POST は Prisma upsert のみなので通常は問題ないが、DB接続のコールドスタート時に10秒を超える可能性がある。 |
| 影響 | コールドスタート時に `POST /api/segments` や `POST /api/sessions` が タイムアウトする可能性。 |
| 確認方法 | Vercel Function Logs で segments/sessions の Duration を確認。 |
| 対処方法 | `vercel.json` に `"app/api/segments/route.js": { "maxDuration": 30 }` と `"app/api/sessions/route.js": { "maxDuration": 30 }` を追加。 |

---

#### B-17: エラーレスポンス形式とFlutter側の期待値の不一致（GitHub Issue #6 関連）

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 30% |
| 原因 | バックエンドの `withApi` は成功時 `{ success: true, data: {...} }` を返す。Flutter側の `AuthenticatedClient._unwrap()` はこの形式を正しくパースする。しかし、**Vercelプラットフォーム自体がエラーを返す場合**（413 Payload Too Large、502 Bad Gateway、504 Gateway Timeout等）、レスポンスボディが `{ success: false, error: "..." }` 形式でない可能性がある。VercelのエラーレスポンスはHTML形式の場合もある。この場合、`jsonDecode(response.body)` が `FormatException` で失敗し、Flutter側でハンドリングされない例外が発生する。 |
| 影響 | Vercelプラットフォームエラー時にFlutterアプリがクラッシュまたは意味不明なエラーメッセージを表示。 |
| 確認方法 | Flutter実機でネットワーク切断時やVercelダウン時のエラーハンドリングを確認。 |
| 対処方法 | `AuthenticatedClient._unwrap()` で `jsonDecode` を try-catch で囲み、パース失敗時は `response.body` をそのままエラーメッセージとして返す。 |

---

#### B-18: 旧フロー — ALLOWED_MIME リストとFlutter送信の不一致可能性

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 25% |
| 原因 | `app/api/transcribe/route.js:13` で `ALLOWED_MIME = ['audio/mp4', 'audio/mpeg', 'audio/m4a', 'audio/aac', 'audio/wav']` を定義。Flutter側の `transcribe_service.dart:174` では `MediaType('audio', 'mp4')` を明示的に設定しているため通常は一致する。ただし、`audioFile.type` が `null` / `undefined` / 空文字の場合（`formData` のファイルにContent-Typeが付与されない場合）、34行目の `if (audioFile.type && ...)` で条件自体がスキップされ、**どんなファイル形式でも通過する**。これはセキュリティリスクだが、パイプラインの動作には直接影響しない。逆に、Vercelのmultipartパーサーがブラウザと異なるContent-Type解釈をする場合、`audioFile.type` が `'application/octet-stream'` 等になり、`ALLOWED_MIME` に含まれないため415エラーが返る可能性がある。 |
| 影響 | Content-Typeが正しく設定されていれば影響なし。不正なContent-Typeの場合は415エラーまたはバリデーションスキップ。 |
| 確認方法 | Vercel Logsで `POST /api/transcribe` のリクエストヘッダー内 Content-Type を確認。 |
| 対処方法 | (1) `audioFile.type` が falsy の場合のデフォルト処理を追加。(2) ファイルの先頭バイト（マジックバイト）でMIMEタイプを判定する強化バリデーション。 |

---

#### B-19: process-audio Edge Function が未デプロイ

| 項目 | 内容 |
|---|---|
| 重要度 | CRITICAL（新フロー使用時） |
| 確率 | 90% |
| 原因 | プロジェクト内に `supabase/functions/` ディレクトリが存在しない。`process-audio` Edge Function のソースコードがリポジトリに含まれていない。ISSUES.md の Issue #42 でも「EF process-audio/Storageバケット準備済み」と記載されているが、実際のコードが確認できない。Supabase MCP でデプロイ済みの可能性はあるが、ローカルのコードベースには存在しない。 |
| 影響 | 新フロー（`_transcribeViaStorage`）が実行された場合、`supabase.functions.invoke('process-audio', ...)` が404または500で失敗する。ただし、現在は `_isSupabaseReady()` が false を返すため新フローは呼ばれない。 |
| 確認方法 | Supabase Dashboard > Edge Functions で `process-audio` 関数の存在を確認。`supabase functions list` でデプロイ状況を確認。 |
| 対処方法 | 新フロー有効化（Issue #42）時に `process-audio` Edge Function を実装・デプロイする。 |

---

#### B-20: レートリミットの識別子 — DEV_AUTH_BYPASS下で全ユーザーが同一識別子

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 50% |
| 原因 | `lib/middleware.js:69` で `const rateLimitId = userId \|\| request.headers.get('x-forwarded-for') \|\| 'anonymous'`。`DEV_AUTH_BYPASS` 有効時、`userId = 'mock-user-001'` が全リクエストに適用されるため、全ユーザー（全デバイス）が同一のレートリミットバケットを共有する。transcribe の 10req/min 制限が全デバイス合算で適用される。 |
| 影響 | 複数デバイスからの同時使用で意図しないレートリミット。ただし、現在は単一ユーザー開発段階のため実害は限定的。 |
| 確認方法 | 複数デバイスから同時にAPIを呼び、429が返るか確認。 |
| 対処方法 | (1) DEV_AUTH_BYPASS時は `x-forwarded-for` をレートリミット識別子に使う。(2) Supabase Auth導入で根本解決。 |

---

#### B-21: Prisma upsert のレースコンディション

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 5% |
| 原因 | `segment-service.js:53-71` と `transcribe/route.js:53-72` の両方で `prisma.segment.upsert()` を使用。`sessionId_segmentNo` 複合ユニーク制約でのupsertだが、同一の `sessionId + segmentNo` に対して同時に2つのリクエストが到達した場合、Prisma の upsert は PostgreSQL の `INSERT ... ON CONFLICT` にコンパイルされるため、原則としてアトミックに処理される。ただし、`findFirst` によるセッション検索 → `upsert` の間に別リクエストが割り込むケース（旧フローの session 自動作成）では、2つのセッションが同時に作成される可能性がある。 |
| 影響 | 実質的にはほぼ発生しない。万が一発生しても、同一 deviceId + userId のACTIVEセッションが2つ存在するだけで、次回のfindFirstで最新が選択される。 |
| 確認方法 | DBでACTIVEセッションの重複を確認。 |
| 対処方法 | セッション作成を `findFirst + create` ではなく `upsert` にするか、PostgreSQL の `SELECT ... FOR UPDATE` でロックする。 |

---

#### B-22: Supabase Admin Client が毎回新規生成される

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 10% |
| 原因 | `lib/supabase.js:17-31` の `getSupabaseAdmin()` は呼び出し毎に `createClient()` を実行する。PrismaClient のようなグローバルキャッシュがない。ただし、`DEV_AUTH_BYPASS` が有効な場合、`authenticateUser()` 内で Supabase クライアントは生成されない（109行目で即座にreturn）。Supabase Auth のJWT検証が必要な場合のみ毎回クライアントが生成される。 |
| 影響 | JWT検証が有効な場合、リクエスト毎のクライアント生成オーバーヘッド。ただし `DEV_AUTH_BYPASS` 下では影響なし。 |
| 確認方法 | 現在は影響なし（DEV_AUTH_BYPASS有効）。 |
| 対処方法 | `getSupabaseAdmin()` の結果をモジュールレベルでキャッシュする。 |

---

#### 調査サマリー

| 重要度 | 件数 | ID |
|---|---|---|
| CRITICAL | 3 | B-01, B-06, B-19 |
| HIGH | 5 | B-02, B-04, B-05, B-08, B-09, B-15 |
| MEDIUM | 6 | B-03, B-07, B-12, B-16, B-17, B-18, B-20 |
| LOW | 4 | B-11, B-13, B-14, B-21, B-22 |

**最も可能性が高い「録音が保存されない」原因（バックエンド起因）:**

1. **B-06 (CRITICAL/95%)**: 旧フローで formData の sessionId が無視され、DB上のセッションIDとFlutter側のセッションIDが不一致。セグメント取得時にヒットしない。
2. **B-04 (HIGH/50%)**: 長い音声セグメントでVercel 60秒タイムアウト + Gemini処理時間超過。
3. **B-09 (HIGH/60%)**: オフラインキュー一斉リプレイで10req/minレートリミット超過。
4. **B-15 (HIGH/70%)**: 古いACTIVEセッションが残存し、データ構造が不正確に。
5. **B-05 (HIGH/35%)**: Gemini APIエラー時に汎用500が返り、Flutter側で適切にハンドリングされない。

---

### Agent 3: Supabase / DB / Storage 調査

> 調査完了: 2026-02-17
> 調査方法: Supabase MCP ツール (list_tables, execute_sql, get_edge_function, get_logs, get_advisors) + ローカルソースコード分析
> Supabase Project: dhwuekyutobpnocwhdut / PostgreSQL 17.6

---

#### S-01: 全15テーブルでRLS有効 + RLSポリシーがゼロ（完全ブロック状態）

| 項目 | 内容 |
|---|---|
| 重要度 | CRITICAL |
| 確率 | 95%（Supabase Client経由アクセス時に確実に発動） |
| 原因 | `public`スキーマの全15テーブル（`segments`, `sessions`, `_prisma_migrations`含む）で`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`が実行済みだが、`pg_policy`テーブルにpublicスキーマのポリシーが**一件も存在しない**。RLS有効 + ポリシーなし = `authenticated`/`anon`ロールからの全操作（SELECT/INSERT/UPDATE/DELETE）が暗黙的に拒否される。Supabase Advisorも全15テーブルで`rls_enabled_no_policy`警告を出力済み。 |
| 影響 | Edge Function `process-audio` が `supabaseAdmin`（service_role、`rolbypassrls=true`）を使用しているためRLSバイパスで動作するが、Supabase JS Client（anon key経由）でのFlutterからの直接DB操作は全てブロック。Prisma接続が`postgres`ロール（`rolbypassrls=true`）であればバイパス可能だが、ロールが`authenticated`/`anon`にフォールバックした場合は全操作ブロック。 |
| 確認方法 | `SELECT * FROM pg_policy pol JOIN pg_class cls ON pol.polrelid = cls.oid JOIN pg_namespace nsp ON cls.relnamespace = nsp.oid WHERE nsp.nspname = 'public'` → **結果0行**（確認済み） |
| 対処方法 | 各テーブルに適切なRLSポリシーを作成。例: `CREATE POLICY "Users can manage own segments" ON public.segments FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`。Prisma経由のみでアクセスする設計なら`ALTER TABLE public.segments DISABLE ROW LEVEL SECURITY`でRLSを無効化。 |

---

#### S-02: Prisma接続はRLSバイパス可能だが接続ロール設定に不確実性

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 70%（DATABASE_URLの設定次第） |
| 原因 | `.env.example`のDATABASE_URLは`postgresql://postgres.[ref]:[pw]@...pooler.supabase.com:6543/postgres?pgbouncer=true`形式。`postgres`ロールは`rolbypassrls=true`のためRLSバイパス可能。**ただし**、Supabase Pooler（Supavisor）経由のTransaction modeでは`SET ROLE`が使えず、接続プールのデフォルトロールに依存。`SELECT current_setting('role')`の結果は`none`（MCPのexecute_sql経由）。さらに`lib/prisma.js`では`@prisma/adapter-neon`等のサーバレスアダプタを使用せず、標準`PrismaClient()`を使用。 |
| 影響 | Prisma経由の操作が`postgres`ロールで実行される場合はRLSバイパスで問題なし。しかし何らかの理由で`authenticated`/`anon`ロールにフォールバックした場合、S-01のRLSポリシー不在により全操作がブロック。 |
| 確認方法 | Vercelデプロイ環境で`prisma.session.findMany()`が結果を返すか確認。Vercelログで`P2021`エラーや空配列返却を確認 |
| 対処方法 | (1) DATABASE_URLが`postgres`ユーザーで接続していることを確認 (2) Supabase Dashboard > Database > Connection Pooling で接続ロール確認 (3) 安全策としてRLSポリシーを追加（S-01の対処） |

---

#### S-03: auth.usersが空（Supabase Authユーザー未登録）

| 項目 | 内容 |
|---|---|
| 重要度 | CRITICAL |
| 確率 | 100%（確認済み） |
| 原因 | `SELECT * FROM auth.users` → **0行**。Supabase Authにユーザーが一人も登録されていない。Authログ（過去24時間）も空。 |
| 影響 | (1) Edge Function `process-audio` はJWT認証を要求（`verify_jwt=true`）し、関数内でも`supabaseUser.auth.getUser()`でユーザー検証。ユーザー不在のためFlutterから正当なJWTを取得不可、Edge Functionを呼び出せない。(2) Storage RLSポリシーも`authenticated`ロール + `auth.uid()`ベースのため、認証なしではアップロード不可。(3) 新フロー（Storage + Edge Function）が完全に機能しない根本原因の一つ。 |
| 確認方法 | MCP `execute_sql`: `SELECT count(*) FROM auth.users` → **0**（確認済み） |
| 対処方法 | (1) Supabase Dashboard > Authentication でユーザーを作成 (2) Flutter側でSupabase Auth（Email/Password or OAuth）によるログインフロー実装 (3) `SupabaseConfig.url` / `SupabaseConfig.anonKey` をビルド時に`--dart-define`で注入 |

---

#### S-04: Edge Function `process-audio` のログが空（一度も呼ばれていない）

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 100%（確認済み） |
| 原因 | Edge Functionログ（過去24時間）が完全に空。S-03（Auth未設定）とRC-1（sessionID不整合）により、新フローのStep 1（PENDINGセグメント作成）で既に失敗し、Step 3（Edge Function invoke）に到達していない。Flutter側の`_isSupabaseReady()`も`currentUser == null`のため`false`を返し、新フロー自体が呼ばれていない。 |
| 影響 | STT（音声→テキスト変換）が一度も実行されていない。segmentsテーブルも0行。 |
| 確認方法 | MCP `get_logs(service=edge-function)` → **空**（確認済み） |
| 対処方法 | 上流のS-03, RC-1, RC-2を先に解決すれば自然に解消 |

---

#### S-05: Edge Function `process-audio` 内のGEMINI_API_KEY環境変数未設定の可能性

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 60%（Vault secretsが空であることから推定） |
| 原因 | Edge Functionコード内で`Deno.env.get("GEMINI_API_KEY")!`を使用。`SUPABASE_URL`と`SUPABASE_SERVICE_ROLE_KEY`はSupabaseが自動注入するが、`GEMINI_API_KEY`はユーザーが`supabase secrets set GEMINI_API_KEY=...`で手動設定する必要がある。`vault.secrets`テーブルクエリ結果が空であり、Secretsが未設定の可能性が高い。 |
| 影響 | Edge Functionが呼ばれた場合、`GEMINI_API_KEY`がundefinedとなり、Gemini API呼び出しが失敗→500エラー→segmentのsttStatusがFAILEDに更新される。 |
| 確認方法 | Supabase Dashboard > Edge Functions > process-audio > Secrets で`GEMINI_API_KEY`設定有無を確認。または`supabase secrets list` |
| 対処方法 | `supabase secrets set GEMINI_API_KEY=AIzaSyXXXXXXXX` で設定 |

---

#### S-06: Storage バケット `audio-segments` のRLSポリシーが `authenticated` ロール限定

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 100%（確認済み） |
| 原因 | Storage RLSポリシー2件確認済み: (1) `Users can read own audio`: SELECT, `authenticated`ロール, USING条件: `bucket_id = 'audio-segments' AND (storage.foldername(name))[1] = auth.uid()::text` (2) `Users can upload own audio`: INSERT, `authenticated`ロール, WITH CHECK条件: 同上。どちらも`authenticated`ロール限定。DELETEポリシーは存在しない。 |
| 影響 | S-03と合わせて、Supabase Auth未設定の現状ではFlutterからのStorage直接アップロードが確実に失敗。Edge FunctionはSTT完了後に`supabaseAdmin.storage.from('audio-segments').remove()`でservice_roleバイパスにより削除可能だが、クライアント側からの削除は不可。 |
| 確認方法 | MCP `execute_sql`でStorage RLSポリシー確認済み。Storage objectsも0件。 |
| 対処方法 | (1) Auth導入が前提 (2) 必要に応じてDELETEポリシー追加: `CREATE POLICY "Users can delete own audio" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'audio-segments' AND (storage.foldername(name))[1] = auth.uid()::text)` |

---

#### S-07: `_prisma_migrations` テーブルにもRLS有効（マイグレーション障害リスク）

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 40%（postgresロールがRLSバイパス可能なら問題なし） |
| 原因 | `_prisma_migrations`テーブルにもRLSが有効化されているがポリシーが存在しない。通常、Prisma Migrateは`postgres`ロール（DIRECT_URL経由、session mode port 5432）で接続するためRLSバイパスできるが、万が一別ロールで実行された場合、マイグレーション履歴の読み書きがブロックされる。 |
| 影響 | `npx prisma migrate dev`や`npx prisma migrate deploy`が失敗する可能性。現在3件のマイグレーション記録が存在（1件はrolled_back）しており、初回マイグレーションは成功済み。 |
| 確認方法 | `npx prisma migrate status`で正常に状態取得できるか確認 |
| 対処方法 | `ALTER TABLE public._prisma_migrations DISABLE ROW LEVEL SECURITY` |

---

#### S-08: segments テーブルのユニーク制約 `(session_id, segment_no)` によるupsert競合

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 30%（オフラインキューリプレイ時） |
| 原因 | `segments`テーブルに`segments_session_id_segment_no_key`ユニーク制約が存在。Prismaの`segment.upsert()`はこの複合キーを使用するため通常は正常動作。オフラインキューからのリプレイ時に同一`(sessionId, segmentNo)`で再送信された場合もupsertで上書きされる。ただし、旧フロー（`POST /api/transcribe`）ではFlutter側のsessionIdが無視され、DB発行のsessionIdが使用されるため、異なるsessionIdで衝突しない。 |
| 影響 | 同一セグメントの二重送信時にP2002エラー（409レスポンス）が発生する可能性。ただしupsert使用のため通常は問題なし。 |
| 確認方法 | オフラインキューリプレイのログで409レスポンスが出ていないか確認 |
| 対処方法 | 現状のupsertパターンで概ね対処済み。リプレイ側で冪等性を保証すれば問題なし |

---

#### S-09: sessions テーブルのFK制約 `sessions_rule_version_id_fkey` が未インデックス

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 15%（パフォーマンス影響のみ） |
| 原因 | `sessions.rule_version_id` → `published_versions.id` のFK制約にカバリングインデックスが存在しない。Supabase Performance Advisorでも`unindexed_foreign_keys`として検出済み。 |
| 影響 | `published_versions`の行を削除する際に`sessions`テーブルの全行スキャンが発生。現在データ量が少ないため実害なし。 |
| 確認方法 | MCP `get_advisors(type=performance)` で確認済み |
| 対処方法 | `CREATE INDEX idx_sessions_rule_version_id ON public.sessions(rule_version_id)` |

---

#### S-10: segments テーブルの `bunjin_id` FK制約が未インデックス

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 15%（パフォーマンス影響のみ） |
| 原因 | `segments.bunjin_id` → `bunjins.id` のFK制約にカバリングインデックスが存在しない。Supabase Performance Advisorでも検出済み。 |
| 影響 | bunjin削除時にsegments全行スキャンが発生。 |
| 確認方法 | MCP `get_advisors(type=performance)` で確認済み |
| 対処方法 | `CREATE INDEX idx_segments_bunjin_id ON public.segments(bunjin_id)` |

---

#### S-11: PgBouncer Transaction Mode での prepared statements 制限

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 50%（Prisma設定次第） |
| 原因 | `.env.example`のDATABASE_URLに`?pgbouncer=true&connection_limit=1&statement_cache_size=0`が設定。`statement_cache_size=0`でprepared statements無効化はPgBouncer Transaction Modeの制限に対応。Prisma 6ではデフォルトでprepared statementsが有効であり、この設定が正しく反映されていない場合、`prepared statement "sX" does not exist`エラーが発生する可能性。 |
| 影響 | 間欠的なDB操作失敗。特にVercelのサーバーレス環境で接続プール再利用時に顕在化。PostgresログにERRORレベルは未検出（現在はLOGレベルの接続ログのみ）。 |
| 確認方法 | Vercelログでprepared statement関連エラーを検索。MCP `get_logs(service=postgres)` → 現在エラーなし |
| 対処方法 | DATABASE_URLに`&statement_cache_size=0`が含まれていることを確認。Prisma schemaの`directUrl`設定でマイグレーション時はsession mode使用の設計は正しい |

---

#### S-12: DEV_AUTH_BYPASS による旧フロー動作可能性（セキュリティリスク）

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 80%（DEV_AUTH_BYPASSがVercelで有効な場合） |
| 原因 | `middleware.js`で`DEV_AUTH_BYPASS === 'true'`の場合、認証スキップで`mock-user-001`をuserIdとして使用。Vercel環境でこの変数が有効なら、旧フロー（`POST /api/transcribe`）はAuth不要で動作する。 |
| 影響 | 旧フロー自体は動作する可能性があるが、user_idが`mock-user-001`固定。Supabase Auth連携との不整合。本番環境でのセキュリティリスク。 |
| 確認方法 | Vercel Environment VariablesでDEV_AUTH_BYPASSの値を確認 |
| 対処方法 | 本番環境ではDEV_AUTH_BYPASSをfalseにするか削除。Supabase Auth移行完了後に削除 |

---

#### S-13: audio_deletion_logs テーブルの冪等性問題

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 5%（現在は無影響） |
| 原因 | `audio_deletion_logs`テーブルは`segment_id`にUNIQUE制約。Edge Function `process-audio`がSTT完了後に削除ログを記録・Storageファイル削除するフロー。同一segmentIdで2回呼ばれた場合、2回目の`audio_deletion_logs.insert`でUNIQUE違反→500エラー（ただしSTT自体は成功済み）。 |
| 影響 | Edge Functionの冪等性が保証されない。 |
| 確認方法 | Edge Functionログでinsertエラー確認（現在ログ空のため問題なし） |
| 対処方法 | Edge Function内で`audio_deletion_logs.upsert()`に変更するか、insert前にexistence checkを追加 |

---

#### S-14: Supabase Storageバケットが非公開（設計通り）

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 5%（設計通り） |
| 原因 | `audio-segments`バケット: `public: false`, `file_size_limit: 10485760`(10MB), `allowed_mime_types: ['audio/mp4', 'audio/mpeg', 'audio/m4a', 'audio/aac', 'audio/wav']`。Storage objects件数: **0件**。 |
| 影響 | 設計通り。Auth導入後に正常動作する。 |
| 確認方法 | `SELECT * FROM storage.buckets` で確認済み |
| 対処方法 | 特になし |

---

#### S-15: Prismaマイグレーション履歴にロールバック痕跡

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 10%（現在は安定） |
| 原因 | `_prisma_migrations`テーブルに3レコード: (1) ID `4dd42ee7` `v1_4_1_bunjin_system` → `rolled_back_at: 2026-02-15T14:15:12`, `applied_steps_count: 0` (2) ID `453cd101` `v1_4_1_bunjin_system` → `finished_at: 2026-02-15T14:15:12`（再適用成功） (3) ID `9494f628` `add_user_settings` → `finished_at: 2026-02-15T14:15:16`（成功）。ロールバック→再適用のプロセスでテーブルのRLS設定が意図せず有効化された可能性あり。 |
| 影響 | マイグレーション自体は正常完了。RLS設定がPrismaマイグレーション外で行われた可能性があるため、マイグレーションにRLS設定を明示的に含めることを推奨。 |
| 確認方法 | 確認済み |
| 対処方法 | 特になし。今後のマイグレーションでRLS設定を明示的に管理 |

---

#### S-16: テーブルGRANT権限は全ロールに付与済み（RLSのみがブロック要因）

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 100%（確認済み、問題なし） |
| 原因 | `segments`, `sessions`, `audio_deletion_logs`テーブルに対して`postgres`, `anon`, `authenticated`, `service_role`の全ロールにSELECT/INSERT/UPDATE/DELETE/REFERENCES/TRIGGER/TRUNCATE権限が付与済み。 |
| 影響 | アクセスブロックの原因はGRANTではなくRLSポリシーの不在（S-01）。 |
| 確認方法 | `information_schema.role_table_grants`で確認済み |
| 対処方法 | 特になし |

---

#### S-17: Postgresログにアプリケーション接続なし（インフラ接続のみ）

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 90%（アプリからのDB接続が発生していない可能性） |
| 原因 | 過去24時間のPostgresログには`supabase_admin`（postgres_exporter, psql, mgmt-api）と`supabase_read_only_user`の接続のみ。`postgres`ロール（Prisma経由）や`authenticated`ロール（Supabase Client経由）からの接続が一切ない。 |
| 影響 | VercelデプロイされたアプリケーションからのDB接続が発生していないことを示唆。(a) DATABASE_URL未設定、(b) アプリにアクセスされていない、(c) Pooler経由で別のログカテゴリに記録される、のいずれか。 |
| 確認方法 | Vercel Environment VariablesでDATABASE_URLが正しく設定されているか確認。`/api/health`エンドポイントにアクセスしてDB接続テスト |
| 対処方法 | Vercelの環境変数設定を再確認 |

---

#### S-18: Edge Function `process-audio` のコード品質・潜在リスク

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 40%（Edge Functionが呼ばれた場合に発動する可能性） |
| 原因 | Edge Functionコード分析で以下の潜在リスクを検出: (1) `supabaseUser`クライアントの生成時にservice_role keyを使用しつつAuthorizationヘッダーを上書き — `auth.getUser()`は正しくJWTを検証するが、他のDB操作にはservice_role権限が適用される可能性 (2) `btoa(new Uint8Array(arrayBuffer).reduce(...))` による大容量音声のbase64変換でメモリ使用量が高騰（10MBファイル→約13.3MBのbase64文字列） (3) STT完了後の`storage_object_path: null`更新→`audio_deletion_logs`記録→Storage削除の3ステップがトランザクション化されていない。途中で失敗した場合に不整合が発生。 |
| 影響 | (1) セキュリティ上のリスク（ただしservice_roleのDB操作はsegment所有権チェック済みのため限定的） (2) 大きな音声ファイルでEdge Functionのメモリ制限に達する可能性 (3) Storage削除とDB更新の不整合 |
| 確認方法 | Edge Functionが実際に呼ばれた際のログを確認（現在は未呼出） |
| 対処方法 | (1) supabaseUserクライアントにはanon keyを使用する (2) ストリーミングbase64変換を検討 (3) 削除ステップにtry-catchを追加し、部分的な失敗を許容するリトライ設計に |

---

#### 調査サマリー（Agent 3）

| 重要度 | 件数 | 主要ID |
|---|---|---|
| CRITICAL | 2 | S-01（RLSポリシー不在）、S-03（Authユーザー不在） |
| HIGH | 4 | S-02（Prisma RLSバイパス不確実）、S-04（Edge Function未呼出）、S-05（GEMINI_API_KEY未設定疑い）、S-06（Storage RLS） |
| MEDIUM | 5 | S-07, S-08, S-11, S-12, S-17, S-18 |
| LOW | 6 | S-09, S-10, S-13, S-14, S-15, S-16 |

**最優先対処チェーン（Agent 3推奨）:**

1. **S-03** → Supabase Authユーザー作成 + Flutter側Login実装
2. **S-01** → 全テーブルにRLSポリシー追加（または不要テーブルのRLS無効化）
3. **S-05** → Edge FunctionにGEMINI_API_KEY設定（`supabase secrets set`）
4. **RC-1**（既知）→ セッションID発行フロー修正
5. 上記完了後、Edge Functionが正常呼出されることを確認（S-04は自然解消）

---

### Agent 4: ネットワーク / 環境 / 設定調査

> 調査完了: 2026-02-17
> 調査範囲: flutter_app/env/prod.json, flutter_app/android/app/src/main/AndroidManifest.xml, flutter_app/android/app/build.gradle.kts, flutter_app/pubspec.yaml, flutter_app/lib/services/offline/ (4ファイル), flutter_app/lib/data/repositories/authenticated_client.dart, flutter_app/lib/services/transcribe/transcribe_service.dart, flutter_app/lib/services/recording/ (4ファイル), flutter_app/lib/core/constants.dart, flutter_app/lib/main.dart, vercel.json, .env.example, next.config.mjs, lib/middleware.js, app/api/transcribe/route.js

---

#### ネットワーク関連

#### N-01: HTTPクライアントタイムアウトとVercel関数タイムアウトの競合

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 40% |
| 原因 | `transcribe_service.dart:177` の旧フロー（multipart POST）は `Duration(seconds: 60)` タイムアウト。Vercel側の `app/api/transcribe/route.js` も `maxDuration: 60` 秒。Gemini STT処理に58-59秒かかった場合、Vercel側で完了してレスポンスを返し始めるがFlutter側のタイムアウトが先に発火し、接続が切断される。さらに、新フローの `_createPendingSegment()` は `Duration(seconds: 15)` だが、Vercel Cold Start（3-5秒）+ DB処理を考慮すると不安定な場合がある。 |
| 影響 | Flutter側でTimeoutExceptionがスローされ、文字起こし結果が受信できない。サーバー側では処理が完了してセグメントが作成されている可能性があり、データ不整合が発生する |
| 確認方法 | Flutter実機ログで `TIMEOUT` キーワードを検索。Vercelログで200応答しているのにFlutter側でエラーになっているケースを特定 |
| 対処方法 | (1) Flutter側のmultipartタイムアウトを90秒に延長（Vercel maxDuration + マージン30秒）。(2) `_createPendingSegment` のタイムアウトを30秒に延長。(3) タイムアウト後にサーバー側のセグメント状態を確認するリカバリロジック追加 |

#### N-02: OfflineQueueServiceのHTTPリクエストにタイムアウト未設定

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 25% |
| 原因 | `offline_queue_service.dart:80-95` の `_processEntry()` 内の `http.post()`, `http.patch()`, `http.delete()` にタイムアウトが設定されていない。Dart の `http` パッケージのデフォルトタイムアウトはプラットフォーム依存（Android: 通常無期限）。 |
| 影響 | ネットワーク不安定時にリクエストが永久にハングし、フラッシュ処理全体がブロックされる。`_isFlushing` フラグがtrueのまま解放されず、以降のキューフラッシュが一切実行されない |
| 確認方法 | オフラインキューの `flush()` が開始されたまま完了しないケースをログで確認（`flush: processing` の後に完了ログがないケース） |
| 対処方法 | 各HTTP呼び出しに `.timeout(const Duration(seconds: 30))` を追加 |

#### N-03: Android Network Security Config未設定（クリアテキスト制限）

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 5%（本番環境ではHTTPSのため） |
| 原因 | `AndroidManifest.xml` に `android:usesCleartextTraffic` 属性も `android:networkSecurityConfig` も設定されていない。`res/xml/network_security_config.xml` も存在しない（Glob確認済み）。Android 9 (API 28) 以降はクリアテキスト（HTTP）通信がデフォルトでブロックされる。`minSdk = 24` のため API 24-27 では問題なし。 |
| 影響 | 開発環境で `http://10.0.2.2:3000`（エミュレータ）や `http://192.168.x.x:3000`（実機）へのHTTP通信が API 28+ でブロックされる。本番環境は `https://record-app-one.vercel.app` なので影響なし |
| 確認方法 | ビルドコマンドに `--dart-define=API_BASE_URL=http://...` を使っている場合のみ発生。`adb logcat | grep "Cleartext HTTP traffic"` で確認 |
| 対処方法 | デバッグビルド用に `res/xml/network_security_config.xml` を追加し、`AndroidManifest.xml` の `<application>` に `android:networkSecurityConfig="@xml/network_security_config"` を設定 |

#### N-04: multipart requestのContent-Length計算問題

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 15% |
| 原因 | `transcribe_service.dart:153` で `http.MultipartRequest` を使用。`http.MultipartFile.fromPath()` で遅延読み込みされるため、プロキシやCDN経由でContent-Length不一致になる可能性がある。Vercel Edge Networkはchunked transfer encodingをサポートするが、中間プロキシで問題が起きることがある。 |
| 影響 | リクエストが中間ネットワーク機器でドロップされ、タイムアウトとして処理される |
| 確認方法 | Vercelログでtranscribeリクエストが到達しているか確認。Flutter側で正常送信ログがあるのにVercel側にアクセスログがないケース |
| 対処方法 | `http.MultipartFile.fromBytes()` でファイル全体をメモリに読み込んでから送信（~4.7MBセグメントでは許容範囲） |

#### N-05: DNS解決・Vercel Edge Network接続問題

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 5% |
| 原因 | Vercel Edge Network (`record-app-one.vercel.app`) と Supabase CDN (`dhwuekyutobpnocwhdut.supabase.co`) のDNS解決が特定のネットワーク環境（公共Wi-Fi、企業ファイアウォール）でブロックされる可能性。 |
| 影響 | 接続自体が確立できず、全API呼び出しが `SocketException` でフェイル |
| 確認方法 | 特定のWi-Fi環境でのみ発生する場合はDNS問題の可能性が高い。Flutter実機ログで `SocketException` や `Failed host lookup` を検索 |
| 対処方法 | エラーメッセージでDNSエラーを検出し、ユーザーにネットワーク切り替えを提案 |

#### N-06: CORS設定不在（Edge Function呼び出し時）

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 3% |
| 原因 | `vercel.json` と `next.config.mjs` にCORS関連の設定がない（Grep確認済み：プロジェクト全体でCORS関連ヘッダーゼロ）。Flutter HTTP clientはブラウザではないためCORSは通常影響しない。 |
| 影響 | ネイティブHTTPクライアント（Flutter dart:io）では通常発生しない |
| 確認方法 | Edge Functionのレスポンスヘッダーに `Access-Control-Allow-Origin` が含まれるか確認 |
| 対処方法 | 現時点ではFlutterネイティブアプリのため対処不要 |

#### N-07: IPv4/IPv6デュアルスタック接続問題

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 3% |
| 原因 | Vercel Edge NetworkはIPv6をサポート。一部のAndroid端末はIPv6が有効だがISPのIPv6サポートが不完全な場合、Happy Eyeballs (RFC 8305) アルゴリズムの実装不十分でIPv6フォールバックに時間がかかることがある。 |
| 影響 | 接続確立に10-30秒余分にかかり、タイムアウトに近づく |
| 確認方法 | 特定のネットワークで初回接続が異常に遅い場合。`adb logcat | grep "ECONNREFUSED\|ENETUNREACH"` |
| 対処方法 | Dart `http` パッケージレベルでの対処は困難 |

---

#### Android固有

#### N-08: BackgroundServiceInitializerのforegroundServiceTypes不整合

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 35% |
| 原因 | `build.gradle.kts:29` で `targetSdk = flutter.targetSdkVersion`（Flutter 3.10+ = targetSdk 34 = Android 14）。Android 14ではフォアグラウンドサービスのtype宣言が厳格化。`AndroidManifest.xml:45` では `foregroundServiceType="microphone\|dataSync"` と2つのtypeを設定しているが、`background_service_initializer.dart:18` では `foregroundServiceTypes: [AndroidForegroundType.microphone]` のみ指定し、**`dataSync` が含まれていない**。 |
| 影響 | バックグラウンドでの文字起こしアップロード（dataSync型操作）がAndroid 14+で制限される可能性。録音自体は `microphone` 型で動作するが、録音停止後のアップロード処理がキルされうる |
| 確認方法 | Android 14端末でバックグラウンド録音後、アプリをバックグラウンドに移動し、文字起こしアップロードが完了するか確認。Logcatで `ForegroundServiceType` 関連の警告を確認 |
| 対処方法 | `background_service_initializer.dart` の `foregroundServiceTypes` に `AndroidForegroundType.dataSync` を追加 |

#### N-09: Doze Mode / App Standby によるネットワーク制限

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 30% |
| 原因 | Android 6.0+ のDoze Modeでは、端末が静止しスクリーンオフの状態が続くとネットワークアクセスが制限される。録音セッションは10分セグメント（`AppConstants.segmentDurationMinutes = 10`）なので、セグメント完了→文字起こしアップロードの間に端末がDoze Modeに入る可能性がある。フォアグラウンドサービス（`microphone`型）は録音中はDoze免除だが、録音停止後のアップロード処理は免除されない。 |
| 影響 | 文字起こしリクエストがDoze Modeのネットワーク制限で失敗し、PendingTranscribeStoreに蓄積される。ConnectivityMonitorはDoze Modeの解除を直接検出しない（N-21参照） |
| 確認方法 | `adb shell dumpsys deviceidle` でDoze状態を確認。長時間録音後にpending_transcribes件数を確認 |
| 対処方法 | (1) `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` 権限を追加し、ユーザーにバッテリー最適化の除外を案内。(2) フォアグラウンドサービスのtypeに `dataSync` を追加し、アップロード完了まで維持。(3) `WorkManager` を使用してDoze Modeのメンテナンスウィンドウでリトライ |

#### N-10: バッテリー最適化（Battery Optimization）

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 25% |
| 原因 | `AndroidManifest.xml` に `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` 権限が未宣言。メーカー固有のバッテリー最適化（Samsung: Adaptive Battery, Xiaomi: Battery Saver, Huawei: App Launch Manager）がフォアグラウンドサービスをキルする可能性がある。`permission_service.dart` でもバッテリー最適化除外のリクエストは行っていない。 |
| 影響 | 録音中にバックグラウンドサービスがキルされ、セグメントが不完全な状態で終了 |
| 確認方法 | 特定メーカーの端末でのみ発生する場合はメーカー固有の最適化が原因。`adb shell am get-standby-bucket com.toshiyaminabe.recordapp` |
| 対処方法 | (1) 設定画面でバッテリー最適化除外の案内を表示。(2) `permission_handler` で `Permission.ignoreBatteryOptimizations` をリクエスト |

#### N-11: Android 12+ の正確なアラーム制限

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 5% |
| 原因 | セグメントタイマーに `dart:async` の `Timer` を使用（`background_recording_handler.dart:141-144`）。`Timer` はDartランタイムのイベントループベースであり、Android の `AlarmManager` は使用していないため正確なアラーム制限の直接的な影響はない。ただし、Dartの `Timer` はプロセスがサスペンドされると遅延する可能性がある。 |
| 影響 | セグメント切り替えタイミングが数秒～数十秒ズレる可能性があるが、録音データ自体は失われない |
| 確認方法 | セグメントの実際の録音時間が10分から大きくズレていないか確認（startAt/endAtの差分） |
| 対処方法 | 現状のフォアグラウンドサービス + Timer で実用上は問題なし |

#### N-12: 大容量ファイルアップロード時のメモリ制約

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 15% |
| 原因 | 新フロー `_transcribeViaStorage()` で `file.readAsBytes()` (`transcribe_service.dart:99`) はファイル全体をメモリに読み込む。10分セグメント(~4.7MB)は通常問題ないが、ローエンド端末（RAM 2-3GB）で複数セグメントが同時処理される場合、OutOfMemoryErrorのリスクがある。 |
| 影響 | OOMでアプリがクラッシュし、録音データとpendingキューが失われる可能性 |
| 確認方法 | ローエンド端末で長時間録音（30分以上）後のメモリ使用量をAndroid Profilerで監視 |
| 対処方法 | (1) Supabase Storage SDKのストリーミングアップロードAPIを使用。(2) セグメント処理を逐次実行 |

---

#### 環境設定

#### N-13: dart-define注入とdefaultValue空文字列の危険性

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 20% |
| 原因 | `constants.dart:25-28` で `ApiConfig.baseUrl` は `String.fromEnvironment('API_BASE_URL', defaultValue: '')`。同様に `SupabaseConfig.url` と `SupabaseConfig.anonKey` も `defaultValue: ''`。`--dart-define-from-file=env/prod.json` を指定せずにビルドすると全て空文字列になる。`main.dart:37-45` で `ApiConfig.baseUrl` のみ空文字列チェックがあるが、`assert(false, ...)` はデバッグモードのみで動作（**リリースビルドでは `assert` がスキップ**）。Supabase URL/anonKeyの空チェックは `main.dart:48` で警告ログのみ。 |
| 影響 | ビルドコマンドのミスでリリースAPKが環境変数なしで生成される。アプリは起動するがすべてのAPI呼び出しが失敗 |
| 確認方法 | リリースAPKを起動し「設定エラー」画面が表示されるか確認 |
| 対処方法 | CI/CDパイプラインで `--dart-define-from-file` の必須チェックを追加 |

#### N-14: Supabase anonKeyのJWT有効期限と埋め込み

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 10% |
| 原因 | `prod.json` のSupabase anonKeyをJWTデコードすると: `iat: 1771074132` (2026-02-15), `exp: 2086650132` (2036-02-12)。有効期限は10年後で当面問題ないが、ビルド済みAPKにハードコードされているため、キーローテーション時にAPK再配布が必要。 |
| 影響 | 当面は影響なし。キーローテーション時に既存APKの全Supabase接続が即座に失敗 |
| 確認方法 | Supabase Dashboard > Settings > API > anon key のステータスを確認 |
| 対処方法 | キーローテーション時はAPK再配布が必須 |

#### N-15: Vercel環境変数の設定漏れリスク

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 30% |
| 原因 | `.env.example` に記載された環境変数のうち、本番に必要な `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` が全て設定されているか不明。healthチェックで `database: true`, `gemini: true` は確認済みだが、`SUPABASE_SERVICE_ROLE_KEY` が未設定の場合 `middleware.js` の `getSupabaseAdmin()` がnullを返す。 |
| 影響 | Auth導入時にJWT検証不能。`DIRECT_URL` 未設定時はマイグレーション実行不可 |
| 確認方法 | Vercel Dashboard > Settings > Environment Variables で全変数の設定状況を確認 |
| 対処方法 | Vercel Dashboardで全必須環境変数を確認・設定 |

#### N-16: DEV_AUTH_BYPASS=true が本番で有効（ユーザーID不整合）

| 項目 | 内容 |
|---|---|
| 重要度 | CRITICAL |
| 確率 | 100%（セキュリティ）/ 50%（録音保存失敗の原因として） |
| 原因 | `middleware.js:109` で `DEV_AUTH_BYPASS === 'true'` の場合、常に `mock-user-001` をuserIdとして使用。Vercel上でこれが有効であることは確認済み。新フロー（Storage + Edge Function）では `Supabase.instance.client.auth.currentUser!.id` でuserIdを取得するため `mock-user-001` とは異なるID。旧フローでは `deviceId` ベースでセッション検索するが `userId = mock-user-001` でフィルタ。**Flutter側のコードに `mock-user-001` のハードコードは存在しない**（Grep確認済み）。 |
| 影響 | (1) セキュリティ: 認証なしで全APIにアクセス可能。(2) 旧フロー: deviceIdベースで動作する可能性あり。(3) 新フロー: userId不整合 |
| 確認方法 | Vercel環境変数で `DEV_AUTH_BYPASS` の値を確認 |
| 対処方法 | (短期) 旧フローがDEV_AUTH_BYPASSで動作することを確認。(長期) Supabase Authを導入しDEV_AUTH_BYPASSを無効化 |

#### N-17: .env vs .env.local の優先順位問題

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 15%（開発環境で影響、本番Vercelは影響なし） |
| 原因 | Next.jsは `.env.local` > `.env` の優先順位で環境変数を読み込む。Vercel CLIが `.env.local` を自動生成する場合があり、ローカル開発時に意図しない環境変数で上書きされる可能性。MEMORY.mdに既知問題として記載済み。 |
| 影響 | ローカル開発時に本番とは異なる環境変数が使用される |
| 確認方法 | プロジェクトルートに `.env.local` ファイルが存在するか確認 |
| 対処方法 | 不要な `.env.local` は削除 |

#### N-18: Vercelリージョン設定とレイテンシ（太平洋横断問題）

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 20% |
| 原因 | `vercel.json` にリージョン設定がない。Vercelのデフォルトリージョンは `iad1`（US East）。`.env.example` の `DATABASE_URL` が `aws-0-ap-northeast-1`（東京）を指す。日本のユーザー → Vercel (US East) → Supabase DB (東京) で**太平洋横断の往復が2回発生**。 |
| 影響 | API応答時間が200-400ms増加。Cold Start + レイテンシの合計でタイムアウトに近づく |
| 確認方法 | `curl -w "%{time_total}" https://record-app-one.vercel.app/api/health` で500ms以上ならリージョン問題 |
| 対処方法 | `vercel.json` に `"regions": ["hnd1"]` を追加（東京リージョン） |

#### N-19: next.config.mjs の bodySizeLimit がServer Actionsのみ適用

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 40% |
| 原因 | `next.config.mjs:11-13` の `serverActions.bodySizeLimit: '10mb'` はServer Actions専用。**API Routes（`app/api/`）には適用されない**。API RoutesのbodySizeはVercelプランに依存（Hobby: 4.5MB, Pro: 5MB）。旧フロー `/api/transcribe` へのmultipartリクエスト（~4.7MB音声 + フォームフィールド）がVercelの4.5MB制限を超える。`route.js:31` の `MAX_AUDIO_SIZE = 6MB` チェックに到達する前にVercelレベルでリジェクト。 |
| 影響 | 旧フローで音声ファイルサイズが4.5MBを超えるとVercelが `413 Payload Too Large` を返す |
| 確認方法 | 10分セグメント（AAC-LC 64kbps 16kHz ~4.7MB）のアップロードが413で失敗するか。Vercelプランを確認 |
| 対処方法 | (1) 新フロー（Storage直接アップロード）に完全移行。(2) セグメント長を短縮（例: 8分）。(3) Vercel Proプラン |

---

#### リトライ・回復

#### N-20: PendingTranscribeStoreのfile_path永続性

| 項目 | 内容 |
|---|---|
| 重要度 | HIGH |
| 確率 | 35% |
| 原因 | `pending_transcribe_store.dart` の `file_path` はアプリdocumentsディレクトリ内のパス。Androidの「ストレージ→データを消去」で音声ファイル削除時、SQLiteの `pending_transcribes` にはエントリが残る。`transcribe_retry_service.dart:42` で `file.exists()` チェック後に dead_letter に移行するが、**ユーザーへの通知がない**。 |
| 影響 | ファイル消失時にリトライがサイレントにdead_letterに移行し、ユーザーは録音喪失に気づかない |
| 確認方法 | `pending_transcribes` の `status = 'dead_letter'` かつファイル不在のケース確認 |
| 対処方法 | (1) dead_letter移行時にユーザーに通知表示。(2) 新フロー（Storage即座アップロード）でローカルファイル依存を排除 |

#### N-21: ConnectivityMonitorのDoze Mode非検出

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 25% |
| 原因 | `connectivity_monitor.dart` の `connectivity_plus` (v6.1.1) `onConnectivityChanged` はDoze Modeのネットワーク制限を検出しない（物理接続は維持、`_wasOffline` は `false` のまま）。Doze Mode解除時にflush/retryがトリガーされない。 |
| 影響 | Doze Mode中に失敗したリクエストがpendingのまま残る |
| 確認方法 | スリープ→Doze Mode→画面ON後にpendingキューが処理されるか確認 |
| 対処方法 | (1) `WidgetsBindingObserver.didChangeAppLifecycleState` でフォアグラウンド復帰時にflush/retry。(2) 定期ポーリング（15分間隔） |

#### N-22: TranscribeRetryServiceのリトライ間隔と最大回数の不足

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 20% |
| 原因 | `maxRetryCount = 5`（`constants.dart:13`）。指数バックオフ: 1s, 2s, 4s, 8s, 16s（最大60s）。5回で合計最大31秒。ネットワーク復旧が30秒以上かかる場合、全リトライ失敗でdead_letter化。OfflineQueueServiceも同じ `maxRetryCount = 5`。 |
| 影響 | 一時的ネットワーク不安定でdead_letter化、手動リトライ必要 |
| 確認方法 | `pending_transcribes` の `status = 'dead_letter'` 件数確認 |
| 対処方法 | (1) `maxRetryCount` を10に増加。(2) ConnectivityMonitor復帰時にdead_letterもリトライ対象に |

#### N-23: ファイル削除タイミングの安全性

| 項目 | 内容 |
|---|---|
| 重要度 | MEDIUM |
| 確率 | 10% |
| 原因 | `transcribe_retry_service.dart:63-64` で `store.markCompleted(entry.id)` → `file.delete()` の順。`markCompleted()` はSQLiteからエントリを**削除**する（`pending_transcribe_store.dart:128`）。`file.delete()` が失敗してもSQLiteエントリは削除済みのため孤立ファイルが発生。 |
| 影響 | 不要ファイルによるストレージ消費（録音データはサーバー側に保存済み） |
| 確認方法 | `recordings/` ディレクトリと `pending_transcribes` テーブルの突き合わせ |
| 対処方法 | 起動時クリーンアップ処理で孤立ファイルを削除 |

#### N-24: OfflineQueueServiceとTranscribeRetryServiceの二重フラッシュ・レートリミット競合

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 10% |
| 原因 | `connectivity_monitor.dart:67-68` で復帰時に `_queueService.flush()` → `_transcribeRetryService?.retryPending()` を順次実行。大量リクエストが同時にVercelに送信され、transcribe 10req/min レートリミットに抵触する可能性。 |
| 影響 | 429エラーで再リトライサイクルに入る |
| 確認方法 | 長時間オフライン後の復帰時に429エラー確認 |
| 対処方法 | flush/retry間に遅延を挟む（staggered flush） |

#### N-25: Proxy / VPN 環境でのTLS接続問題

| 項目 | 内容 |
|---|---|
| 重要度 | LOW |
| 確率 | 5% |
| 原因 | 企業VPN/プロキシのMITL TLSインスペクションで、Dart `http` パッケージ（v1.2.2）がカスタムCA証明書を検証できず `HandshakeException: CERTIFICATE_VERIFY_FAILED` が発生する可能性。 |
| 影響 | VercelおよびSupabaseへの全通信が失敗 |
| 確認方法 | VPN/プロキシ環境でのみ発生する場合 |
| 対処方法 | 一般ユーザー向けアプリのため特別な対処は不要 |

---

#### 調査サマリー（Agent 4）

| カテゴリ | CRITICAL | HIGH | MEDIUM | LOW |
|---|---|---|---|---|
| ネットワーク | 0 | 1 (N-01) | 2 (N-02, N-04) | 4 (N-03, N-05, N-06, N-07) |
| Android固有 | 0 | 2 (N-08, N-09) | 2 (N-10, N-12) | 1 (N-11) |
| 環境設定 | 1 (N-16) | 3 (N-13, N-15, N-19) | 2 (N-14, N-17) | 0 |
| リトライ/回復 | 0 | 1 (N-20) | 3 (N-21, N-22, N-23) | 2 (N-24, N-25) |
| **合計** | **1** | **7** | **9** | **7** |

**最も録音保存失敗に直結する問題（優先対処順）:**

1. **N-16** (CRITICAL/100%): DEV_AUTH_BYPASS=true が本番有効。セキュリティ問題 + 新フローのuserId不整合
2. **N-19** (HIGH/40%): Vercel API Route bodySizeLimit未設定。~4.7MBセグメントが413リジェクトの可能性大
3. **N-01** (HIGH/40%): HTTPタイムアウト競合（Flutter 60s = Vercel 60s、マージンゼロ）
4. **N-08** (HIGH/35%): BackgroundServiceInitializerにdataSync foregroundServiceType未設定
5. **N-20** (HIGH/35%): PendingTranscribeStoreのファイル消失時にサイレントdead_letter化
6. **N-15** (HIGH/30%): Vercel環境変数（特にSUPABASE_SERVICE_ROLE_KEY）の設定漏れ
7. **N-09** (HIGH/30%): Doze Mode中のネットワーク制限対策なし
8. **N-13** (HIGH/20%): dart-define未指定時のリリースビルド脆弱性
9. **N-18** (MEDIUM/20%): Vercelリージョン=US East vs DB=東京の太平洋横断レイテンシ

---

## 統合分析・優先対処リスト

> 統合日: 2026-02-17
> 全4エージェントの81件の発見事項を統合・クロスリファレンス分析

---

### 決定的証拠: DBデータ確認結果（統合分析フェーズで発見）

| テーブル | 行数 | 意味 |
|---|---|---|
| `sessions` | **0** | 一度もセッションが作成されていない |
| `segments` | **0** | 一度もセグメントが保存されていない |
| `auth.users` | **0** | Supabase Authユーザーなし（既知） |

**結論: 録音パイプラインはデータベースに一度も到達していない。**

これは「保存されたが参照できない」ではなく「データが完全にDBに到達していない」ことを意味する。
考えられるのは以下のいずれか:
1. Flutter側でAPI呼び出し自体が失敗している（413/timeout/ネットワークエラー）
2. Vercel Function に到達しているが、DB書き込み前にエラー発生
3. Flutter側で録音→セグメント完了→API呼び出しのフロー自体が動作していない

Supabase PostgresログにはVercelからの接続痕跡（アプリケーション接続）が確認できず、
mgmt-api（Supabase管理）とpostgres_exporter（モニタリング）のみ。
**Vercel FunctionからこのSupabase DBへの接続自体が発生していない可能性が高い。**

> **重要仮説**: Vercelの`DATABASE_URL`が別のDB（旧Neonなど）を指している可能性。
> Vercel healthチェックで`database: true`が返るのは、Vercelが接続できるDBがあることを意味するが、
> それがこのSupabase DBかどうかは未確認。

---

### 現在のデータフロー確認（実際に動作しているパス）

```
[現在の実動作フロー]

Flutter App (LoginPage無効 → currentUser=null)
  → _isSupabaseReady() = false
  → 旧フロー（_transcribeViaMultipart）にフォールバック
  → POST /api/transcribe (multipart/form-data)
     - audio: m4a file (~4.7MB for 10min segment)
     - deviceId: SharedPreferences UUID
     - sessionId: Flutter側 UUID (使われない)
     - segmentNo: Flutter RecordingNotifier採番 (BG Handlerと不一致の可能性)
     - Authorization: なし (currentSession=null)
  → Vercel Serverless Function
     - DEV_AUTH_BYPASS=true → userId=mock-user-001
     - deviceIdでACTIVEセッション検索 → なければ自動作成
     - Gemini 2.0 Flash STT実行
     - セグメントDB保存 (upsert)
  → 200 or エラー
```

---

### 根本原因の階層分析

#### Tier 0: 確実なブロッカー（100%発生、即座に修正必須）

| # | ID | 問題 | 影響 | 根拠 |
|---|---|---|---|---|
| 1 | **N-19 + B-08** | **Vercel Hobby プラン body size 制限 (4.5MB) vs 10分セグメント (~4.7MB)** | 10分録音のセグメントが413 Payload Too Largeで拒否される。`next.config.mjs`の`bodySizeLimit: '10mb'`はアプリ層の設定であり、Vercel Hobbyプランのインフラ制限(4.5MB)を超えられない | 64kbps * 600秒 = 4,800KB ≈ 4.7MB。Hobby: 4.5MB / Pro: 5MB。安全マージンなし |
| 2 | **F-02 + S-03** | **Supabase Auth完全未使用（LoginPage無効 + auth.usersテーブル空）** | 新フロー（Storage + Edge Function）が永久に無効。旧フローに固定。将来のマルチユーザー対応不可 | main.dart:125-128コメントアウト確認済み。auth.users 0行確認済み |
| 3 | **S-01** | **全15テーブルRLS有効 + ポリシー0件** | Prisma（postgresロール）は影響なし。しかしSupabase Client/Edge Function（service_role以外）からの全操作ブロック。新フロー復旧時に必ず直面 | pg_policy 0行確認済み |

#### Tier 1: 高確率ブロッカー（現行フローで発生している可能性が高い）

| # | ID | 問題 | 確率 | 影響 |
|---|---|---|---|---|
| 4 | **B-04 + N-01** | **Gemini STTタイムアウト連鎖**: 長い音声→Gemini処理>55秒→Vercel 60秒制限→Flutter 60秒制限のゼロマージン競合 | 50-70% | STT結果消失。サーバー側で処理完了してもFlutter側タイムアウトでレスポンス受信できず |
| 5 | **F-03 + F-04** | **segmentNo二重管理**: BG Handler独自採番 vs RecordingNotifier独自採番。SegmentCompletedイベントでBG側segmentNoが伝達されない | 95% | unique constraint `(sessionId, segmentNo)` 違反でDB保存失敗、または前セグメントの上書き |
| 6 | **B-06** | **旧フローでFlutter側sessionId無視**: 全セグメントがDB側の自動生成sessionIdに紐づくが、Flutter側は自分のsessionIdで照会 | 95% | Flutter側でセグメント取得時にヒットしない→ユーザーに「保存されていない」と表示 |
| 7 | **B-09** | **オフラインキュー一斉リプレイでレートリミット超過** (10req/min) | 60% | 接続回復時に溜まったセグメントが一斉送信→429エラー→リトライループ |

#### Tier 2: 条件付きブロッカー（特定条件下で発生）

| # | ID | 問題 | 条件 | 確率 |
|---|---|---|---|---|
| 8 | **F-06** | BG Service readyハンドシェイク5秒タイムアウト | 低スペック端末/初回起動 | 30% |
| 9 | **F-13 + N-09** | Android Doze Mode で録音・通信中断 | 画面OFF + 長時間録音 | 50% |
| 10 | **N-08** | BackgroundService foregroundServiceType未設定 | Android 14+ | 35% |
| 11 | **B-05** | Gemini APIエラー時の汎用500応答（エラー種別不明） | Gemini API障害時 | 35% |
| 12 | **F-07** | セグメント境界でのファイルレースコンディション | 高負荷時 | 20% |
| 13 | **B-15** | 古いACTIVEセッション残存→新セッション作成されず古いセッションにデータ追加 | 前回未クローズ | 70% |
| 14 | **N-20** | PendingTranscribeStore ファイル消失→サイレントdead_letter化 | アプリ再インストール/ストレージクリア | 35% |

#### Tier 3: 潜在リスク（現行フローでは未発動だが修正推奨）

| # | ID | 問題 | 備考 |
|---|---|---|---|
| 15 | S-04 | Edge Function process-audio 未呼出 | 新フロー復旧まで影響なし |
| 16 | S-05 | Edge Function GEMINI_API_KEY 未設定疑い | 新フロー復旧まで影響なし |
| 17 | S-06 | Storage audio-segments バケット RLS | service_role使用なら影響なし |
| 18 | B-01 + N-16 | DEV_AUTH_BYPASS 本番有効 | セキュリティリスクだが現行フローの動作には必要 |
| 19 | B-19 | process-audio コードがリポジトリに不在 | Edge Function管理の問題 |
| 20 | S-08 | audio_deletion_logs テーブルの型不整合 (BIGINT vs TEXT) | データ追跡の信頼性 |

---

### 「録音が保存されない」最も可能性の高いシナリオ

#### シナリオ A: 10分セグメントの body size 超過（確率: 80%）

```
録音10分 → m4a 4.7MB生成
→ POST /api/transcribe (multipart 4.7MB)
→ Vercel Hobby Plan 4.5MB制限
→ 413 Payload Too Large (Vercelインフラ層で拒否)
→ Flutter: HTTP 413受信 → PendingTranscribeStoreに追加
→ 接続回復時にリトライ → 同じ413 → 永久失敗ループ
→ ユーザー: 「保存されない」
```

**検証方法**: Vercel Function ログで413レスポンスを検索。またはFlutter側で送信ペイロードサイズをログ出力。

#### シナリオ B: Gemini STTタイムアウト（確率: 50%）

```
録音10分 → m4a 4.7MB → POST /api/transcribe
→ 4.5MB未満ならVercelに到達 (短いセグメントの場合)
→ Gemini generateContent() 開始
→ 処理に55-65秒 → Vercel maxDuration=60秒超過
→ 504 Gateway Timeout
→ Flutter: タイムアウト or 504受信
→ PendingTranscribeStoreに追加 → 永久リトライ
```

**検証方法**: Vercel Function ログでタイムアウトエラーを検索。Gemini API呼び出しの処理時間計測。

#### シナリオ C: segmentNo重複によるDB制約違反（確率: 40%）

```
BG Handler: segmentNo=0 でonSegmentCompleted発火
→ RecordingNotifier: 独自カウンタ segmentCount=0+1=1
→ TranscribeService に segmentNo=1 で送信 (BG側は0)
→ 2回目: BG segmentNo=1, RecordingNotifier segmentNo=2
→ DB upsertで segmentNo ずれ → データ上書き or 欠番
→ 最悪ケース: unique constraint violation → 500エラー
```

**検証方法**: DBの segments テーブルで sessionId ごとの segmentNo 連番を確認。欠番や重複がないか検査。

#### シナリオ D: セッションID不一致でデータ参照不可（確率: 70%）

```
Flutter: sessionId=UUID-local-xxx で録音管理
→ POST /api/transcribe で sessionId=UUID-local-xxx 送信
→ サーバー: sessionIdを無視、deviceIdでセッション検索/作成
→ DB: sessionId=UUID-server-yyy でセグメント保存
→ Flutter: sessionId=UUID-local-xxx でセグメント照会 → 0件
→ ユーザー: 「保存されていない」（実際にはDBに存在するが参照できない）
```

**検証方法**: DB `sessions` テーブルと `segments` テーブルの sessionId を確認。Flutter側のUUIDと一致するか検査。

---

### 優先対処ロードマップ

#### Phase 1: 即座の修正（旧フローを確実に動かす）— 1-2日

| 順序 | 対象ID | 修正内容 | 理由 |
|---|---|---|---|
| 1-1 | N-19 | **セグメント分割時間を5分に短縮**（4.7MB→~2.4MB）、または音声品質を48kbpsに下げる（4.7MB→~3.5MB） | body size超過が最有力ブロッカー。サーバー側変更不要 |
| 1-2 | F-03/F-04 | **segmentNo採番をBG Handlerに一元化**。SegmentCompletedイベントで正確なsegmentNoを伝達 | unique constraint違反の防止 |
| 1-3 | N-01 | **Flutter側タイムアウトを90秒に延長**（Vercel 60s + マージン30s） | タイムアウト競合の解消 |
| 1-4 | B-06 | **Flutter側のセグメント参照をdeviceIdベースに統一**（サーバーが返すsessionIdをローカルに保持） | セッションID不一致の解消 |
| 1-5 | B-15 | **録音開始時に古いACTIVEセッションをSTOPする**API呼び出し追加 | セッション残存問題の解消 |

#### Phase 2: 安定化（エラーハンドリング強化）— 3-5日

| 順序 | 対象ID | 修正内容 | 理由 |
|---|---|---|---|
| 2-1 | B-04/B-05 | **Gemini API呼び出しにタイムアウト(50秒)設定** + エラー種別判定（4xx→永久エラー、5xx→リトライ可） | STTタイムアウトの予防 |
| 2-2 | F-09/N-20 | **PendingTranscribeStoreに永久エラー判定** (413/400→dead_letter即時化、リトライ上限10回) | 無限リトライループの防止 |
| 2-3 | B-09 | **オフラインキューリプレイにレートリミット考慮** (5秒間隔で送信) | 429エラー連鎖の防止 |
| 2-4 | N-08 | **BackgroundServiceInitializerにforegroundServiceType: dataSync追加** | Android 14+対応 |
| 2-5 | F-06 | **BGサービスreadyハンドシェイクを10秒に延長** + リトライ | 低スペック端末対応 |

#### Phase 3: 新フロー復旧（Supabase Auth + Storage + Edge Function）— 1-2週間

| 順序 | 対象ID | 修正内容 | 理由 |
|---|---|---|---|
| 3-1 | F-02/S-03 | **LoginPage有効化 + Supabase Auth設定** (email/password or OAuth) | 認証フローの復旧 |
| 3-2 | S-01 | **全テーブルにRLSポリシー作成** (userId = auth.uid()) | Supabase Client経由のDB操作許可 |
| 3-3 | RC-1/F-01 | **録音開始時にPOST /api/sessions** → 返却sessionIdを使用 | セッションID整合性 |
| 3-4 | S-05 | **Edge FunctionにGEMINI_API_KEY設定** (`supabase secrets set`) | Edge Function STT実行 |
| 3-5 | B-01/N-16 | **DEV_AUTH_BYPASS無効化** (本番環境) | セキュリティ修正 |

#### Phase 4: 品質向上（長期）

| 対象ID | 修正内容 |
|---|---|
| S-08 | audio_deletion_logs 型修正 (BIGINT→TEXT UUID) |
| B-19 | Edge Functionコードのリポジトリ管理 |
| S-17/S-18 | Edge Function内のトランザクション化 + メモリ最適化 |
| N-18 | Vercelリージョン最適化（東京リージョン検討） |
| B-12/B-16/B-17 | API一貫性修正（レスポンスエンベロープ統一） |

---

### 即座の検証手順

#### ステップ1: Vercelログで413/504を確認

```bash
# Vercel Function ログ確認（過去24時間）
# → 413 Payload Too Large が出ているか
# → 504 Gateway Timeout が出ているか
```

MCPツール: `get_logs(service: 'api')` でVercel側ログを確認。

#### ステップ2: DBの実データ確認

```sql
-- セッション存在確認
SELECT id, device_id, status, created_at FROM sessions ORDER BY created_at DESC LIMIT 10;

-- セグメント存在確認（実は保存されているが参照できないケース）
SELECT s.id, s.session_id, s.segment_no, s.status, s.created_at
FROM segments s
ORDER BY s.created_at DESC LIMIT 20;

-- segmentNo重複チェック
SELECT session_id, segment_no, COUNT(*) as cnt
FROM segments
GROUP BY session_id, segment_no
HAVING COUNT(*) > 1;
```

#### ステップ3: Flutter実機デバッグ

```
1. adb logcat | grep -E "TIMEOUT|413|500|ERROR|TranscribeService"
2. 短い録音（1分）でテスト → 成功するなら body size が原因
3. 長い録音（10分）でテスト → 失敗するなら body size 確定
```

---

### 全発見事項クロスリファレンス（81件）

| Agent | CRITICAL | HIGH | MEDIUM | LOW | 合計 |
|---|---|---|---|---|---|
| Flutter (F-01〜F-16) | 3 | 4 | 4 | 5 | 16 |
| Backend (B-01〜B-22) | 3 | 6 | 7 | 6 | 22 |
| Supabase (S-01〜S-18) | 2 | 4 | 6 | 6 | 18 |
| Network (N-01〜N-25) | 1 | 7 | 9 | 8 | 25 |
| **合計** | **9** | **21** | **26** | **25** | **81** |

---

### 結論

**「録音が保存されない」根本原因は単一ではなく、複数の問題が連鎖している。**

最も可能性が高い直接原因は **Vercel Hobbyプランの body size制限 (4.5MB) に対して10分セグメントが~4.7MB** であること。これにより大半のセグメントが413で拒否され、PendingTranscribeStoreに蓄積されるが、リトライしても同じ413で永久失敗する。

短いセグメント（<7分）が成功する場合でも、**Gemini STTタイムアウト（60秒制限）**、**segmentNo二重管理によるDB制約違反**、**セッションID不一致による参照不能** が追加の失敗要因として存在する。

**Phase 1の修正（特にセグメント分割時間の短縮）を最優先で実施すべき。** これだけで旧フローの成功率が大幅に改善する見込み。
