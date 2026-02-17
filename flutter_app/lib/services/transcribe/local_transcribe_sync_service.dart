import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/app_logger.dart';
import '../../core/constants.dart';
import '../../data/local/local_transcribe_store.dart';

/// ローカル文字起こし結果のサーバー同期サービス
///
/// TranscribeRetryService のパターンを踏襲。
/// ローカルSQLiteに保存された文字起こしテキストを
/// POST /api/transcribe/local でサーバーに同期する。
class LocalTranscribeSyncService {
  final LocalTranscribeStore _store;
  final String _baseUrl;
  bool _isSyncing = false;

  /// 指数バックオフの基本遅延（ミリ秒）
  static const int _baseDelayMs = 1000;

  /// 指数バックオフの最大遅延（ミリ秒）
  static const int _maxDelayMs = 60000;

  /// レートリミット対策の最低リトライ間隔（ミリ秒）
  static const int _minRetryIntervalMs = 5000;

  LocalTranscribeSyncService({
    required LocalTranscribeStore store,
    required String baseUrl,
  })  : _store = store,
        _baseUrl = baseUrl;

  /// ConnectivityMonitor から呼ばれるエントリポイント
  Future<void> syncPending() async {
    if (_isSyncing) return;
    _isSyncing = true;

    try {
      final entries = await _store.listPending();
      AppLogger.queue(
        'local sync: ${entries.length} pending entries found',
      );

      for (final entry in entries) {
        try {
          AppLogger.queue(
            'local sync: entry#${entry.id} sessionId=${entry.sessionId} '
            'segmentNo=${entry.segmentNo}',
          );

          final headers = <String, String>{
            'Content-Type': 'application/json',
          };

          // Authヘッダー（あれば付与）
          try {
            final session = Supabase.instance.client.auth.currentSession;
            if (session != null) {
              headers['Authorization'] = 'Bearer ${session.accessToken}';
            }
          } catch (_) {
            // Supabase未初期化
          }

          final response = await http.post(
            Uri.parse('$_baseUrl/api/transcribe/local'),
            headers: headers,
            body: jsonEncode({
              'sessionId': entry.sessionId,
              'segmentNo': entry.segmentNo,
              'startAt': entry.startAt.toIso8601String(),
              'endAt': entry.endAt.toIso8601String(),
              'text': entry.text,
              'selectedMode': entry.selectedMode,
              'executedMode': entry.executedMode,
              'fallbackReason': entry.fallbackReason,
              'localEngineVersion': entry.localEngineVersion,
            }),
          ).timeout(const Duration(seconds: 30));

          if (response.statusCode >= 200 && response.statusCode < 300) {
            // 成功 → ローカルデータ削除
            await _store.markCompleted(entry.id);
            AppLogger.queue('local sync: entry#${entry.id} SUCCESS');
          } else if (response.statusCode >= 400 && response.statusCode < 500) {
            // 4xx永久エラー → dead letter
            AppLogger.queue(
              'local sync: entry#${entry.id} permanent error '
              '(${response.statusCode}), dead_letter',
            );
            await _store.markDeadLetter(entry.id);
          } else {
            // 5xxサーバーエラー → リトライ
            AppLogger.queue(
              'local sync: entry#${entry.id} server error '
              '(${response.statusCode}), retry',
            );
            await _handleRetry(entry);
            break; // ネットワーク不安定時は残りスキップ
          }
        } catch (e) {
          // ネットワークエラー → リトライ
          AppLogger.queue(
            'local sync: entry#${entry.id} network error, retry',
            error: e,
          );
          await _handleRetry(entry);
          break;
        }
      }
    } finally {
      _isSyncing = false;
    }
  }

  Future<void> _handleRetry(LocalTranscribeEntry entry) async {
    final newRetry = entry.retryCount + 1;
    if (newRetry > AppConstants.maxRetryCount) {
      AppLogger.queue(
        'local sync: entry#${entry.id} exceeded max retries, dead_letter',
      );
      await _store.markDeadLetter(entry.id);
    } else {
      final delayMs = max(
        _minRetryIntervalMs,
        min(
          _baseDelayMs * pow(2, entry.retryCount).toInt(),
          _maxDelayMs,
        ),
      );
      AppLogger.queue(
        'local sync: entry#${entry.id} retryCount=$newRetry, backoff=${delayMs}ms',
      );
      await Future.delayed(Duration(milliseconds: delayMs));
      await _store.markFailed(entry.id, newRetry);
    }
  }

  LocalTranscribeStore get store => _store;
}
