/// アプリ定数
class AppConstants {
  // ユーザーID（モック）
  // CRITICAL: バックエンドと一致させること
  static const String mockUserId = 'mock-user-001';

  // 録音設定
  static const int segmentDurationMinutes = 10;
  static const int sampleRate = 16000;
  static const int bitRate = 64000;

  // オフラインキュー
  static const int maxQueueSizeMB = 500;
  static const int warningThresholdMinutes = 20;

  // リトライ
  static const int maxRetryCount = 5;

  // 文人デフォルトカラー
  static const String defaultBunjinColor = '#3B82F6';

  // UTC Note: すべてのDateTime操作は .toUtc() を使用すること
}

/// API設定
class ApiConfig {
  // --dart-define=API_BASE_URL=https://your-app.vercel.app で切り替え
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );
}
