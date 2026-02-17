import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/core/transcribe_mode.dart';
import 'package:flutter_app/services/transcribe/transcribe_engine.dart';
import 'package:flutter_app/services/transcribe/transcribe_request_context.dart';

void main() {
  group('TranscribeEngineResult', () {
    test('必須フィールドで生成できる', () {
      const result = TranscribeEngineResult(
        text: 'こんにちは',
        selectedMode: TranscribeMode.server,
        executedMode: TranscribeMode.server,
      );

      expect(result.text, 'こんにちは');
      expect(result.selectedMode, TranscribeMode.server);
      expect(result.executedMode, TranscribeMode.server);
      expect(result.fallbackReason, isNull);
      expect(result.localEngineVersion, isNull);
      expect(result.segmentId, isNull);
    });

    test('フォールバック情報付きで生成できる', () {
      const result = TranscribeEngineResult(
        text: 'テスト',
        selectedMode: TranscribeMode.local,
        executedMode: TranscribeMode.server,
        fallbackReason: 'model not available',
      );

      expect(result.selectedMode, TranscribeMode.local);
      expect(result.executedMode, TranscribeMode.server);
      expect(result.fallbackReason, 'model not available');
    });

    test('ローカルエンジンバージョン付きで生成できる', () {
      const result = TranscribeEngineResult(
        text: 'ローカルテスト',
        selectedMode: TranscribeMode.local,
        executedMode: TranscribeMode.local,
        localEngineVersion: 'whisper-1.0.0',
      );

      expect(result.localEngineVersion, 'whisper-1.0.0');
    });
  });

  group('TranscribeRequestContext', () {
    test('不変DTOとして生成できる', () {
      final context = TranscribeRequestContext(
        filePath: '/path/to/audio.m4a',
        deviceId: 'device-123',
        sessionId: 'session-456',
        segmentNo: 0,
        startAt: DateTime.utc(2026, 2, 17, 10, 0),
        endAt: DateTime.utc(2026, 2, 17, 10, 5),
      );

      expect(context.filePath, '/path/to/audio.m4a');
      expect(context.deviceId, 'device-123');
      expect(context.sessionId, 'session-456');
      expect(context.segmentNo, 0);
    });
  });
}
