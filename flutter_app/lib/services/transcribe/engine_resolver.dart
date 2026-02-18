import '../../core/app_logger.dart';
import '../../core/transcribe_mode.dart';
import 'transcribe_engine.dart';
import 'server_engine.dart';

/// STTエンジン解決
///
/// selectedMode に基づいて適切な TranscribeEngine を返す。
/// ローカルエンジンはファクトリ経由で遅延生成し、
/// サーバーモードでは一切ロードしない。
class EngineResolver {
  final ServerEngine _serverEngine;
  TranscribeEngine? _localEngine;
  final TranscribeEngine Function()? _localEngineFactory;

  EngineResolver({
    required ServerEngine serverEngine,
    TranscribeEngine? localEngine,
    TranscribeEngine Function()? localEngineFactory,
  })  : _serverEngine = serverEngine,
        _localEngine = localEngine,
        _localEngineFactory = localEngineFactory;

  /// ローカルエンジンを登録（Phase 3で WhisperEngine を注入）
  void registerLocalEngine(TranscribeEngine engine) {
    _localEngine = engine;
  }

  /// selectedMode に基づいてエンジンを解決
  ///
  /// - SERVER → ServerEngine
  /// - LOCAL + ローカルエンジンキャッシュ済み → _localEngine
  /// - LOCAL + ファクトリあり → ファクトリで生成（try-catch付き）
  /// - LOCAL + ファクトリなし/失敗 → ServerEngine（フォールバック）
  TranscribeEngine resolve(TranscribeMode selectedMode) {
    switch (selectedMode) {
      case TranscribeMode.server:
        AppLogger.api('EngineResolver: resolved to ServerEngine');
        return _serverEngine;
      case TranscribeMode.local:
        // キャッシュ済みのローカルエンジンがあればそのまま返す
        if (_localEngine != null) {
          AppLogger.api('EngineResolver: resolved to LocalEngine (cached)');
          return _localEngine!;
        }
        // ファクトリからの遅延生成を試行
        if (_localEngineFactory != null) {
          try {
            final engine = _localEngineFactory!();
            _localEngine = engine;
            AppLogger.api(
                'EngineResolver: resolved to LocalEngine (factory created)');
            return engine;
          } catch (e, st) {
            AppLogger.api(
              'EngineResolver: factory failed ($e), fallback to ServerEngine\n$st',
            );
            return _serverEngine;
          }
        }
        AppLogger.api(
          'EngineResolver: local engine not registered, fallback to ServerEngine',
        );
        return _serverEngine;
    }
  }

  /// ローカルエンジンが利用可能かどうか
  bool get isLocalEngineAvailable =>
      _localEngine != null || _localEngineFactory != null;
}
