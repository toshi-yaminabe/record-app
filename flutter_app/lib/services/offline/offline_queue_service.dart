import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import '../../core/app_logger.dart';
import '../../core/constants.dart';
import '../../core/errors.dart';
import '../../data/local/offline_queue_db.dart';
import '../../data/local/queue_entry.dart';

/// オフラインキューサービス
class OfflineQueueService {
  final OfflineQueueDB _db;
  final String baseUrl;
  bool _isFlushing = false;

  /// 指数バックオフの基本遅延（ミリ秒）
  static const int _baseDelayMs = 1000;

  /// 指数バックオフの最大遅延（ミリ秒）
  static const int _maxDelayMs = 60000;

  OfflineQueueService({
    OfflineQueueDB? db,
    this.baseUrl = ApiConfig.baseUrl,
  }) : _db = db ?? OfflineQueueDB();

  /// リクエストをキューに追加
  Future<void> enqueue({
    required String endpoint,
    required String method,
    required Map<String, dynamic> payload,
  }) async {
    AppLogger.queue('enqueue: $method $endpoint');
    final entry = QueueEntry(
      endpoint: endpoint,
      method: method,
      payload: jsonEncode(payload),
      createdAt: DateTime.now().toUtc(),
    );
    await _db.enqueue(entry);
  }

  /// キューをフラッシュ（オンライン時に実行）
  Future<void> flush() async {
    if (_isFlushing) return;
    _isFlushing = true;

    try {
      while (true) {
        final entry = await _db.dequeueNext();
        if (entry == null) break;

        if (entry.id == null) {
          AppLogger.queue('ERROR: entry has null id, skipping');
          continue;
        }

        AppLogger.queue(
            'flush: processing entry#${entry.id} -> ${entry.endpoint}');
        final success = await _processEntry(entry);
        if (!success) {
          // リトライ失敗: 指数バックオフ待機後にフラッシュ中断
          break;
        }
      }
    } finally {
      _isFlushing = false;
    }
  }

  /// エントリを処理（サーバーに送信）
  Future<bool> _processEntry(QueueEntry entry) async {
    try {
      final uri = Uri.parse('$baseUrl${entry.endpoint}');
      late http.Response response;

      switch (entry.method) {
        case 'POST':
          response = await http.post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: entry.payload,
          );
          break;
        case 'PATCH':
          response = await http.patch(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: entry.payload,
          );
          break;
        case 'DELETE':
          response = await http.delete(uri);
          break;
        default:
          throw ApiException('Unsupported HTTP method: ${entry.method}');
      }

      AppLogger.queue(
          'flush: entry#${entry.id} -> HTTP ${response.statusCode}');

      if (response.statusCode >= 200 && response.statusCode < 300) {
        // 成功: レスポンスボディの基本検証
        if (!_validateResponseBody(response)) {
          AppLogger.queue(
              'WARNING: entry#${entry.id} succeeded but response body invalid');
        }
        await _db.markCompleted(entry.id!);
        return true;
      } else if (response.statusCode >= 400 && response.statusCode < 500) {
        return await _handle4xxError(entry, response.statusCode);
      } else {
        // サーバーエラー (5xx): リトライ
        return await _handleRetry(entry);
      }
    } catch (e) {
      // ネットワークエラー: リトライ
      AppLogger.queue('flush: entry#${entry.id} network error', error: e);
      return await _handleRetry(entry);
    }
  }

  /// レスポンスボディの基本検証
  bool _validateResponseBody(http.Response response) {
    if (response.body.isEmpty) return true;
    try {
      jsonDecode(response.body);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// 4xxエラーの細分化処理
  Future<bool> _handle4xxError(QueueEntry entry, int statusCode) async {
    switch (statusCode) {
      case 408: // Timeout - リトライ可能
        AppLogger.queue(
            'retry: entry#${entry.id} HTTP 408 Timeout, will retry');
        return await _handleRetry(entry);
      case 429: // Rate Limit - リトライ可能
        AppLogger.queue(
            'retry: entry#${entry.id} HTTP 429 Rate Limit, will retry');
        return await _handleRetry(entry);
      case 409: // Conflict - 冪等性: 既に処理済み
        AppLogger.queue(
            'completed: entry#${entry.id} HTTP 409 Conflict (already processed)');
        await _db.markCompleted(entry.id!);
        return true;
      default: // 400, 403, 404, 422 等 - 永久削除
        AppLogger.queue(
            'completed: entry#${entry.id} HTTP $statusCode (permanent client error)');
        await _db.markCompleted(entry.id!);
        return true;
    }
  }

  /// リトライ処理（指数バックオフ付き）
  Future<bool> _handleRetry(QueueEntry entry) async {
    final newRetryCount = entry.retryCount + 1;

    if (newRetryCount > AppConstants.maxRetryCount) {
      AppLogger.queue(
          'dead_letter: entry#${entry.id} exceeded max retries');
      await _db.markDeadLetter(entry.id!);
      return true;
    } else {
      // 指数バックオフ: baseDelay * 2^retryCount, capped at maxDelay
      final delayMs = min(
        _baseDelayMs * pow(2, entry.retryCount).toInt(),
        _maxDelayMs,
      );
      AppLogger.queue(
          'retry: entry#${entry.id} retryCount=$newRetryCount, backoff=${delayMs}ms');
      await Future.delayed(Duration(milliseconds: delayMs));
      await _db.markFailed(entry.id!, newRetryCount);
      return false;
    }
  }

  /// 未処理エントリ数を取得
  Future<int> pendingCount() async {
    return await _db.pendingCount();
  }

  /// dead letterエントリ数を取得
  Future<int> deadLetterCount() async {
    return await _db.deadLetterCount();
  }

  /// dead letterエントリをpendingに戻して再試行
  Future<void> retryDeadLetters() async {
    await _db.resetDeadLetters();
  }

  /// キューをクリア
  Future<void> clear() async {
    await _db.clear();
  }

  /// サービスを破棄
  Future<void> dispose() async {
    await _db.close();
  }
}
