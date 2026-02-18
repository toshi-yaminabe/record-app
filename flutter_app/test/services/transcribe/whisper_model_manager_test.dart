import 'package:flutter_test/flutter_test.dart';
import 'package:whisper_ggml/whisper_ggml.dart' as whisper;
import 'package:flutter_app/services/transcribe/whisper_model_manager.dart';

void main() {
  group('WhisperModelManager', () {
    test('デフォルトモデルはsmall', () {
      final manager = WhisperModelManager();
      expect(manager.model, whisper.WhisperModel.small);
    });

    test('カスタムモデルを指定できる', () {
      final manager =
          WhisperModelManager(model: whisper.WhisperModel.tiny);
      expect(manager.model, whisper.WhisperModel.tiny);
    });

    test('初期状態はisReady=false', () {
      final manager = WhisperModelManager();
      expect(manager.isReady, isFalse);
    });

    test('ensureReady後はisReady=true', () async {
      final manager = WhisperModelManager();
      await manager.ensureReady();
      expect(manager.isReady, isTrue);
    });

    test('ensureReadyは冪等（2回呼んでもOK）', () async {
      final manager = WhisperModelManager();
      await manager.ensureReady();
      await manager.ensureReady();
      expect(manager.isReady, isTrue);
    });

    test('versionStringにモデル名が含まれる', () {
      final manager =
          WhisperModelManager(model: whisper.WhisperModel.small);
      expect(manager.versionString, 'whisper_ggml:small');
    });

    test('versionStringにtinyモデル名が含まれる', () {
      final manager =
          WhisperModelManager(model: whisper.WhisperModel.tiny);
      expect(manager.versionString, 'whisper_ggml:tiny');
    });
  });
}
