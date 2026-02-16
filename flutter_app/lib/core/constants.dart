/// アプリ定数
class AppConstants {
  // 録音設定
  static const int segmentDurationMinutes = 5;
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
  // ビルド時に注入: --dart-define-from-file=env/prod.json
  // または: --dart-define=API_BASE_URL=https://your-app.vercel.app
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );
}

/// Supabase設定
class SupabaseConfig {
  static const String url = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: '',
  );

  static const String anonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: '',
  );
}
