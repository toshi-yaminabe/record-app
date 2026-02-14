import 'dart:io';
import 'dart:math';
import '../../core/app_logger.dart';
import '../../core/constants.dart';
import '../transcribe/transcribe_service.dart';
import 'pending_transcribe_store.dart';

/// 文字起こしリトライサービス
///
/// PendingTranscribeStore からエントリを取得し、
/// TranscribeService.transcribe() を直接呼び出してリトライする。
class TranscribeRetryService {
  final PendingTranscribeStore _store;
  final TranscribeService _transcribeService;
  bool _isRetrying = false;

  /// 指数バックオフの基本遅延（ミリ秒）
  static const int _baseDelayMs = 1000;

  /// 指数バックオフの最大遅延（ミリ秒）
  static const int _maxDelayMs = 60000;

  TranscribeRetryService({
    required PendingTranscribeStore store,
    required TranscribeService transcribeService,
  })  : _store = store,
        _transcribeService = transcribeService;

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

          await _transcribeService.transcribe(
            filePath: entry.filePath,
            deviceId: entry.deviceId,
            sessionId: entry.sessionId,
            segmentNo: entry.segmentNo,
            startAt: entry.startAt,
            endAt: entry.endAt,
          );

          // 成功 → エントリ削除 + ファイル削除
          await _store.markCompleted(entry.id);
          await file.delete();
          AppLogger.queue(
              'transcribe retry: entry#${entry.id} SUCCESS, file deleted');
        } catch (e) {
          final newRetryCount = entry.retryCount + 1;

          if (newRetryCount > AppConstants.maxRetryCount) {
            AppLogger.queue(
                'transcribe retry: entry#${entry.id} exceeded max retries, dead_letter');
            await _store.markDeadLetter(entry.id);
          } else {
            // 指数バックオフ: baseDelay * 2^retryCount, capped at maxDelay
            final delayMs = min(
              _baseDelayMs * pow(2, entry.retryCount).toInt(),
              _maxDelayMs,
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

  PendingTranscribeStore get store => _store;
}
