/// アプリ定数
class AppConstants {
  // 録音設定
  static const int segmentDurationMinutes = 10;
  static const int sampleRate = 16000;
  static const int bitRate = 64000;

  // オフラインキュー
  static const int maxQueueSizeMB = 500;
  static const int warningThresholdMinutes = 20;

  // リトライ
  static const int maxRetryCount = 2;
}

/// Supabase設定
/// TODO: 環境変数または設定ファイルから読み込む
class SupabaseConfig {
  static const String url = 'YOUR_SUPABASE_URL';
  static const String anonKey = 'YOUR_SUPABASE_ANON_KEY';
}
