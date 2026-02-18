/// 品質評価結果（不変DTO）
class QualityEvaluation {
  final bool pass;
  final double score;
  final String? reason;

  const QualityEvaluation({
    required this.pass,
    required this.score,
    this.reason,
  });
}

/// 品質評価コンテキスト（Engine結果 + メタデータ）
class QualityEvaluationContext {
  final String text;
  final Duration audioDuration;
  final int attemptNumber;

  const QualityEvaluationContext({
    required this.text,
    required this.audioDuration,
    required this.attemptNumber,
  });
}

/// 文字起こし品質評価インターフェース（Strategy Pattern）
///
/// 後からWER評価、長さベース評価などに差し替え可能。
/// DI 1行変更で評価ロジックを切替。
abstract class TranscribeQualityEvaluator {
  /// 文字起こし結果を評価
  Future<QualityEvaluation> evaluate(QualityEvaluationContext context);
}

/// 常にパスする評価器（Phase 3Aスタブ）
///
/// 全てのテキストを品質OKとして扱う。
/// 将来のPhaseで実際の品質評価ロジックに差し替え。
class AlwaysPassEvaluator implements TranscribeQualityEvaluator {
  const AlwaysPassEvaluator();

  @override
  Future<QualityEvaluation> evaluate(QualityEvaluationContext context) async {
    return const QualityEvaluation(
      pass: true,
      score: 1.0,
      reason: 'AlwaysPassEvaluator: stub evaluation',
    );
  }
}
