enum TranscribeMode {
  server,
  local,
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
