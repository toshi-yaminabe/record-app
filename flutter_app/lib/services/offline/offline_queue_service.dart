import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import '../../core/constants.dart';
import '../../core/errors.dart';
import '../../data/local/offline_queue_db.dart';
import '../../data/local/queue_entry.dart';

/// オフラインキューサービス
class OfflineQueueService {
  final OfflineQueueDB _db;
  final String baseUrl;
  bool _isFlushing = false;

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
    // 相互排他制御: 既にフラッシュ中なら何もしない
    if (_isFlushing) return;
    _isFlushing = true;

    try {
      while (true) {
        final entry = await _db.dequeueNext();
        if (entry == null) break; // キューが空

        final success = await _processEntry(entry);
        if (!success) {
          // ネットワークエラーなどで失敗した場合、フラッシュを中断
          break;
        }
      }
    } finally {
      _isFlushing = false;
    }
  }

  /// エントリを処理（サーバーに送信）
  Future<bool> _processEntry(QueueEntry entry) async {
    const maxRetries = 5;

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

      if (response.statusCode >= 200 && response.statusCode < 300) {
        // 成功: エントリを削除
        await _db.markCompleted(entry.id!);
        return true;
      } else if (response.statusCode >= 400 && response.statusCode < 500) {
        // クライアントエラー: リトライしても無駄なので削除
        await _db.markCompleted(entry.id!);
        return true;
      } else {
        // サーバーエラー: リトライ
        return await _handleRetry(entry);
      }
    } catch (e) {
      // ネットワークエラー: リトライ
      return await _handleRetry(entry);
    }
  }

  /// リトライ処理
  Future<bool> _handleRetry(QueueEntry entry) async {
    const maxRetries = 5;
    final newRetryCount = entry.retryCount + 1;

    if (newRetryCount > maxRetries) {
      // 最大リトライ回数超過: 削除
      await _db.markCompleted(entry.id!);
      return true;
    } else {
      // Exponential backoff: 2^retryCount 秒待機
      final backoffSeconds = pow(2, newRetryCount).toInt();
      await Future.delayed(Duration(seconds: backoffSeconds));
      await _db.markFailed(entry.id!, newRetryCount);
      return false; // フラッシュを中断
    }
  }

  /// 未処理エントリ数を取得
  Future<int> pendingCount() async {
    return await _db.pendingCount();
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
