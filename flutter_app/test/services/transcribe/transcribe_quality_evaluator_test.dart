import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/services/transcribe/transcribe_quality_evaluator.dart';

void main() {
  group('QualityEvaluation', () {
    test('不変DTOとして生成できる', () {
      const eval = QualityEvaluation(pass: true, score: 0.95, reason: 'good');
      expect(eval.pass, isTrue);
      expect(eval.score, 0.95);
      expect(eval.reason, 'good');
    });

    test('reasonはオプショナル', () {
      const eval = QualityEvaluation(pass: false, score: 0.3);
      expect(eval.pass, isFalse);
      expect(eval.score, 0.3);
      expect(eval.reason, isNull);
    });
  });

  group('QualityEvaluationContext', () {
    test('必須フィールドで生成できる', () {
      const ctx = QualityEvaluationContext(
        text: 'テスト文字起こし',
        audioDuration: Duration(seconds: 60),
        attemptNumber: 1,
      );
      expect(ctx.text, 'テスト文字起こし');
      expect(ctx.audioDuration, const Duration(seconds: 60));
      expect(ctx.attemptNumber, 1);
    });
  });

  group('AlwaysPassEvaluator', () {
    late AlwaysPassEvaluator evaluator;

    setUp(() {
      evaluator = const AlwaysPassEvaluator();
    });

    test('常にpass=trueを返す', () async {
      final result = await evaluator.evaluate(const QualityEvaluationContext(
        text: 'テスト',
        audioDuration: Duration(seconds: 30),
        attemptNumber: 1,
      ));
      expect(result.pass, isTrue);
      expect(result.score, 1.0);
      expect(result.reason, contains('AlwaysPassEvaluator'));
    });

    test('空テキストでもpass=true', () async {
      final result = await evaluator.evaluate(const QualityEvaluationContext(
        text: '',
        audioDuration: Duration(seconds: 60),
        attemptNumber: 1,
      ));
      expect(result.pass, isTrue);
    });

    test('複数回呼び出しても一貫してpass=true', () async {
      for (var i = 1; i <= 3; i++) {
        final result = await evaluator.evaluate(QualityEvaluationContext(
          text: 'attempt $i',
          audioDuration: const Duration(seconds: 60),
          attemptNumber: i,
        ));
        expect(result.pass, isTrue);
        expect(result.score, 1.0);
      }
    });

    test('TranscribeQualityEvaluatorインターフェースを実装', () {
      expect(evaluator, isA<TranscribeQualityEvaluator>());
    });
  });
}
