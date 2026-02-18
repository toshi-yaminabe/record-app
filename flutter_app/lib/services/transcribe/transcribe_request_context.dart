import '../../core/transcribe_mode.dart';

/// 文字起こしリクエストの不変データ転送オブジェクト
class TranscribeRequestContext {
  final String filePath;
  final String deviceId;
  final String sessionId;
  final int segmentNo;
  final DateTime startAt;
  final DateTime endAt;
  final TranscribeMode mode;

  const TranscribeRequestContext({
    required this.filePath,
    required this.deviceId,
    required this.sessionId,
    required this.segmentNo,
    required this.startAt,
    required this.endAt,
    required this.mode,
  });
}
