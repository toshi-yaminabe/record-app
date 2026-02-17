import '../../core/transcribe_mode.dart';
import 'transcribe_request_context.dart';

/// 文字起こしエンジン結果（mode情報付き）
class TranscribeEngineResult {
  final String text;
  final TranscribeMode selectedMode;
  final TranscribeMode executedMode;
  final String? fallbackReason;
  final String? localEngineVersion;
  final String? segmentId;

  const TranscribeEngineResult({
    required this.text,
    required this.selectedMode,
    required this.executedMode,
    this.fallbackReason,
    this.localEngineVersion,
    this.segmentId,
  });
}

/// 文字起こしエンジン抽象インターフェース
abstract class TranscribeEngine {
  /// 音声ファイルを文字起こしする
  Future<TranscribeEngineResult> transcribe(TranscribeRequestContext context);
}
