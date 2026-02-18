import 'dart:io';
import 'dart:math';
import 'package:http/http.dart' as http;
import '../../core/app_logger.dart';
import '../../core/constants.dart';
import '../../core/transcribe_mode.dart';
import '../transcribe/server_engine.dart';
import '../transcribe/transcribe_request_context.dart';
import '../transcribe/transcribe_service.dart';
import 'pending_transcribe_store.dart';

/// 文字起こしリトライサービス
///
/// PendingTranscribeStore からエントリを取得し、
/// ServerEngine.transcribe() を呼び出してリトライする。
class TranscribeRetryService {
  final PendingTranscribeStore _store;
  final ServerEngine _serverEngine;
  bool _isRetrying = false;

  /// 指数バックオフの基本遅延（ミリ秒）
  static const int _baseDelayMs = 1000;

  /// 指数バックオフの最大遅延（ミリ秒）
  static const int _maxDelayMs = 60000;

  /// レートリミット対策の最低リトライ間隔（ミリ秒）
  static const int _minRetryIntervalMs = 5000;

  TranscribeRetryService({
    required PendingTranscribeStore store,
    required ServerEngine serverEngine,
  })  : _store = store,
        _serverEngine = serverEngine;

  /// pending状態のエントリをリトライ
  Future<void> retryPending() async {
    if (_isRetrying) return;
    _isRetrying = true;

    try {
      final entries = await _store.listPending();
      AppLogger.queue(
          'transcribe retry: ${entries.length} pending entries found');

      for (final entry in entries) {
        final file = File(entry.filePath);

        if (!await file.exists()) {
          AppLogger.queue(
              'transcribe retry: entry#${entry.id} file not found, moving to dead_letter');
          await _store.markDeadLetter(entry.id);
          continue;
        }

        try {
          AppLogger.queue(
              'transcribe retry: entry#${entry.id} -> ${entry.filePath}');

          final context = TranscribeRequestContext(
            filePath: entry.filePath,
            deviceId: entry.deviceId,
            sessionId: entry.sessionId,
            segmentNo: entry.segmentNo,
            startAt: entry.startAt,
            endAt: entry.endAt,
            mode: TranscribeMode.server,
          );
          await _serverEngine.transcribe(context);

          // 成功 → エントリ削除 + ファイル削除
          await _store.markCompleted(entry.id);
          await file.delete();
          AppLogger.queue(
              'transcribe retry: entry#${entry.id} SUCCESS, file deleted');
        } catch (e) {
          // HTTPステータスコードに基づく永久エラー判定
          if (_isPermanentError(e)) {
            AppLogger.queue(
                'transcribe retry: entry#${entry.id} permanent error (4xx), moving to dead_letter',
                error: e);
            await _store.markDeadLetter(entry.id);
            continue; // 次のエントリへ
          }

          final newRetryCount = entry.retryCount + 1;

          if (newRetryCount > AppConstants.maxRetryCount) {
            AppLogger.queue(
                'transcribe retry: entry#${entry.id} exceeded max retries, dead_letter');
            await _store.markDeadLetter(entry.id);
          } else {
            // 指数バックオフ: baseDelay * 2^retryCount, capped at maxDelay
            // レートリミット対策で最低5秒間隔を確保
            final delayMs = max(
              _minRetryIntervalMs,
              min(
                _baseDelayMs * pow(2, entry.retryCount).toInt(),
                _maxDelayMs,
              ),
            );
            AppLogger.queue(
                'transcribe retry: entry#${entry.id} failed, retryCount=$newRetryCount, backoff=${delayMs}ms',
                error: e);
            await Future.delayed(Duration(milliseconds: delayMs));
            await _store.markFailed(entry.id, newRetryCount);
            // ネットワークエラーの場合は残りのエントリもスキップ
            break;
          }
        }
      }
    } finally {
      _isRetrying = false;
    }
  }

  /// エラーが永久的（リトライしても無意味）かを判定
  /// 4xxエラー（413, 400, 404等）→ 即dead_letter化
  /// 5xxエラー → リトライ対象（一時的なサーバーエラーの可能性）
  bool _isPermanentError(dynamic error) {
    final message = error.toString();

    // ServerEngineException でstatusCodeを持つ場合
    if (error is ServerEngineException && error.statusCode != null) {
      final statusCode = error.statusCode!;
      if (statusCode >= 400 && statusCode < 500) {
        return true;
      }
    }

    // TranscribeException でstatusCodeを持つ場合（ServerEngine委任後）
    if (error is TranscribeException && error.statusCode != null) {
      final statusCode = error.statusCode!;
      if (statusCode >= 400 && statusCode < 500) {
        return true;
      }
    }

    // ステータスコードを抽出（例: "文字起こし失敗 (413): ... (HTTP 413)"）
    final statusMatch = RegExp(r'\((\d{3})\)').firstMatch(message);
    if (statusMatch != null) {
      final statusCode = int.parse(statusMatch.group(1)!);
      if (statusCode >= 400 && statusCode < 500) {
        return true;
      }
    }

    // http.ClientException の場合
    if (error is http.ClientException) {
      final clientMessage = error.toString();
      final clientMatch = RegExp(r'(\d{3})').firstMatch(clientMessage);
      if (clientMatch != null) {
        final statusCode = int.parse(clientMatch.group(1)!);
        if (statusCode >= 400 && statusCode < 500) {
          return true;
        }
      }
    }

    // HttpException の場合
    if (error is HttpException) {
      final httpMessage = error.message;
      if (httpMessage.contains('413') || // Payload Too Large
          httpMessage.contains('400') || // Bad Request
          httpMessage.contains('404') || // Not Found
          httpMessage.contains('415')) {
        // Unsupported Media Type
        return true;
      }
    }

    // その他のエラーはリトライ対象
    return false;
  }

  PendingTranscribeStore get store => _store;
}
