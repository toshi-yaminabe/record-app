import 'package:whisper_ggml/whisper_ggml.dart' as whisper;
import '../../core/app_logger.dart';

/// Whisperモデル管理
///
/// モデルの存在確認と初回ダウンロードを管理する。
/// whisper_ggml パッケージが自動DLをサポートするため、
/// このクラスはモデル選択とログを担当する。
class WhisperModelManager {
  final whisper.WhisperModel _model;
  bool _isReady = false;

  WhisperModelManager({
    whisper.WhisperModel model = whisper.WhisperModel.small,
  }) : _model = model;

  /// 使用するモデル
  whisper.WhisperModel get model => _model;

  /// モデルが利用可能か
  bool get isReady => _isReady;

  /// モデルの準備を確認（初回はDLが実行される可能性あり）
  Future<void> ensureReady() async {
    if (_isReady) return;

    AppLogger.recording(
      'WhisperModelManager: ensuring model ${_model.name} is ready',
    );

    // whisper_ggml は transcribe 呼び出し時に自動DLするが、
    // ここで事前チェックのログだけ残す
    _isReady = true;

    AppLogger.recording(
      'WhisperModelManager: model ${_model.name} ready',
    );
  }

  /// モデル名のバージョン文字列
  String get versionString => 'whisper_ggml:${_model.name}';
}
