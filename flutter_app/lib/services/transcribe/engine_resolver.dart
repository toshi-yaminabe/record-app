import '../../core/app_logger.dart';
import '../../core/transcribe_mode.dart';
import 'transcribe_engine.dart';
import 'server_engine.dart';

/// STTエンジン解決
///
/// selectedMode に基づいて適切な TranscribeEngine を返す。
/// Phase 3で WhisperEngine 登録後は LOCAL→WhisperEngine に切り替わる。
class EngineResolver {
  final ServerEngine _serverEngine;
  TranscribeEngine? _localEngine;

  EngineResolver({
    required ServerEngine serverEngine,
    TranscribeEngine? localEngine,
  })  : _serverEngine = serverEngine,
        _localEngine = localEngine;

  /// ローカルエンジンを登録（Phase 3で WhisperEngine を注入）
  void registerLocalEngine(TranscribeEngine engine) {
    _localEngine = engine;
  }

  /// selectedMode に基づいてエンジンを解決
  ///
  /// - SERVER → ServerEngine
  /// - LOCAL + ローカルエンジン登録済み → _localEngine
  /// - LOCAL + ローカルエンジン未登録 → ServerEngine（フォールバック）
  TranscribeEngine resolve(TranscribeMode selectedMode) {
    switch (selectedMode) {
      case TranscribeMode.server:
        AppLogger.api('EngineResolver: resolved to ServerEngine');
        return _serverEngine;
      case TranscribeMode.local:
        if (_localEngine != null) {
          AppLogger.api('EngineResolver: resolved to LocalEngine');
          return _localEngine!;
        }
        AppLogger.api(
          'EngineResolver: local engine not registered, fallback to ServerEngine',
        );
        return _serverEngine;
    }
  }

  /// ローカルエンジンが利用可能かどうか
  bool get isLocalEngineAvailable => _localEngine != null;
}
