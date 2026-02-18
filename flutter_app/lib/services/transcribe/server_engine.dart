import '../../core/app_logger.dart';
import '../../core/transcribe_mode.dart';
import 'transcribe_engine.dart';
import 'transcribe_request_context.dart';
import 'transcribe_service.dart';

/// サーバーSTTエンジン
///
/// TranscribeService に委任することでコード重複を排除。
/// mainがStorage+EFフローを有効化したら、自動的に新フロー対応。
class ServerEngine implements TranscribeEngine {
  final TranscribeService _transcribeService;

  ServerEngine({required TranscribeService transcribeService})
      : _transcribeService = transcribeService;

  @override
  Future<TranscribeEngineResult> transcribe(
    TranscribeRequestContext context,
  ) async {
    AppLogger.api(
      'ServerEngine: delegating to TranscribeService '
      'sessionId=${context.sessionId} segmentNo=${context.segmentNo}',
    );

    final result = await _transcribeService.transcribe(
      filePath: context.filePath,
      deviceId: context.deviceId,
      sessionId: context.sessionId,
      segmentNo: context.segmentNo,
      startAt: context.startAt,
      endAt: context.endAt,
    );

    return TranscribeEngineResult(
      text: result.text,
      selectedMode: TranscribeMode.server,
      executedMode: TranscribeMode.server,
      segmentId: result.segmentId,
    );
  }
}

/// サーバーエンジン例外
class ServerEngineException implements Exception {
  final String message;
  final int? statusCode;

  ServerEngineException(this.message, {this.statusCode});

  @override
  String toString() => statusCode != null
      ? '$message (HTTP $statusCode)'
      : message;
}
