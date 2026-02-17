enum TranscribeMode {
  server,
  local;

  /// API送信用文字列値
  String toApiValue() {
    switch (this) {
      case TranscribeMode.server:
        return 'SERVER';
      case TranscribeMode.local:
        return 'LOCAL';
    }
  }

  /// API受信値からenumに変換
  static TranscribeMode fromApiValue(String value) {
    switch (value) {
      case 'SERVER':
        return TranscribeMode.server;
      case 'LOCAL':
        return TranscribeMode.local;
      default:
        return TranscribeMode.server;
    }
  }
}

extension TranscribeModeLabel on TranscribeMode {
  String get label {
    switch (this) {
      case TranscribeMode.server:
        return 'WEBサーバー文字起こし';
      case TranscribeMode.local:
        return 'ローカル文字起こし';
    }
  }

  String get description {
    switch (this) {
      case TranscribeMode.server:
        return '今まで通りサーバー経由で文字起こしします';
      case TranscribeMode.local:
        return '端末内で文字起こしします（開発中）';
    }
  }
}
