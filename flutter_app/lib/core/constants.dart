/// アプリ定数
class AppConstants {
  // 録音設定
  static const int segmentDurationMinutes = 10;
  static const int sampleRate = 16000;
  static const int bitRate = 64000;

  // オフラインキュー（Phase 3で使用）
  static const int maxQueueSizeMB = 500;
  static const int warningThresholdMinutes = 20;

  // リトライ（Phase 4で使用）
  static const int maxRetryCount = 2;
}

/// API設定
class ApiConfig {
  // 開発環境: ローカルサーバー
  // 本番環境: デプロイ先URLに変更
  static const String baseUrl = 'http://10.0.2.2:3000'; // Android Emulator用
  // static const String baseUrl = 'http://localhost:3000'; // iOS Simulator用
  // static const String baseUrl = 'https://your-app.vercel.app'; // 本番用
}
