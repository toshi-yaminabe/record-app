import 'dart:io';
import 'package:whisper_ggml/whisper_ggml.dart' as whisper;
import '../../core/app_logger.dart';
import '../../core/transcribe_mode.dart';
import 'audio_converter.dart';
import 'server_engine.dart';
import 'transcribe_engine.dart';
import 'transcribe_request_context.dart';
import 'whisper_model_manager.dart';

/// ローカルWhisper STTエンジン
///
/// 1. モデル準備確認
/// 2. m4a → 16kHz mono WAV 変換
/// 3. whisper.cpp で文字起こし
/// 4. WAV一時ファイル削除
///
/// 失敗時: ServerEngine にフォールバック (fallbackReason記録)
/// FR-011: 音声をサーバーに送信しない
class WhisperEngine implements TranscribeEngine {
  final WhisperModelManager _modelManager;
  final AudioConverter _audioConverter;
  final ServerEngine _serverEngine;
  final whisper.WhisperController _controller;

  WhisperEngine({
    required WhisperModelManager modelManager,
    required AudioConverter audioConverter,
    required ServerEngine serverEngine,
    whisper.WhisperController? controller,
  })  : _modelManager = modelManager,
        _audioConverter = audioConverter,
        _serverEngine = serverEngine,
        _controller = controller ?? whisper.WhisperController();

  @override
  Future<TranscribeEngineResult> transcribe(
    TranscribeRequestContext context,
  ) async {
    try {
      return await _transcribeLocally(context);
    } catch (e) {
      AppLogger.recording(
        'WhisperEngine: local transcription failed, falling back to server',
        error: e,
      );

      final serverResult = await _serverEngine.transcribe(context);

      return TranscribeEngineResult(
        text: serverResult.text,
        selectedMode: TranscribeMode.local,
        executedMode: TranscribeMode.server,
        fallbackReason: e.toString(),
        segmentId: serverResult.segmentId,
      );
    }
  }

  Future<TranscribeEngineResult> _transcribeLocally(
    TranscribeRequestContext context,
  ) async {
    // 1. モデル準備
    await _modelManager.ensureReady();

    // 2. m4a → WAV 変換
    AppLogger.recording(
      'WhisperEngine: converting audio for ${context.sessionId}/'
      '${context.segmentNo}',
    );
    final wavPath = await _audioConverter.convertToWav(context.filePath);

    try {
      // 3. Whisper 文字起こし
      AppLogger.recording(
        'WhisperEngine: transcribing with ${_modelManager.model.name}',
      );
      final result = await _controller.transcribe(
        model: _modelManager.model,
        audioPath: wavPath,
        lang: 'ja',
      );

      final text = result?.transcription.text ?? '';

      AppLogger.recording(
        'WhisperEngine: transcription complete '
        'text=${text.length}chars',
      );

      return TranscribeEngineResult(
        text: text,
        selectedMode: TranscribeMode.local,
        executedMode: TranscribeMode.local,
        localEngineVersion: _modelManager.versionString,
      );
    } finally {
      // 4. WAV一時ファイル削除
      final wavFile = File(wavPath);
      if (await wavFile.exists()) {
        await wavFile.delete();
        AppLogger.recording('WhisperEngine: cleaned up WAV $wavPath');
      }
    }
  }
}
