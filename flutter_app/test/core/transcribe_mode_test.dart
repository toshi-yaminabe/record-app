import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/core/transcribe_mode.dart';

void main() {
  group('TranscribeMode.toApiValue', () {
    test('server → SERVER', () {
      expect(TranscribeMode.server.toApiValue(), 'SERVER');
    });

    test('local → LOCAL', () {
      expect(TranscribeMode.local.toApiValue(), 'LOCAL');
    });
  });

  group('TranscribeMode.fromApiValue', () {
    test('SERVER → server', () {
      expect(TranscribeMode.fromApiValue('SERVER'), TranscribeMode.server);
    });

    test('LOCAL → local', () {
      expect(TranscribeMode.fromApiValue('LOCAL'), TranscribeMode.local);
    });

    test('不明な値は server にフォールバック', () {
      expect(TranscribeMode.fromApiValue('UNKNOWN'), TranscribeMode.server);
    });
  });

  group('TranscribeModeLabel', () {
    test('server の label', () {
      expect(TranscribeMode.server.label, contains('サーバー'));
    });

    test('local の label', () {
      expect(TranscribeMode.local.label, contains('ローカル'));
    });

    test('server の description', () {
      expect(TranscribeMode.server.description, isNotEmpty);
    });

    test('local の description', () {
      expect(TranscribeMode.local.description, isNotEmpty);
    });
  });
}
