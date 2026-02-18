import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/services/transcribe/audio_converter.dart';

void main() {
  group('AudioConverter', () {
    test('constコンストラクタで生成できる', () {
      const converter = AudioConverter();
      expect(converter, isA<AudioConverter>());
    });
  });

  group('AudioConverterException', () {
    test('メッセージ付きで生成', () {
      final ex = AudioConverterException('変換失敗');
      expect(ex.message, '変換失敗');
      expect(ex.toString(), '変換失敗');
    });
  });
}
