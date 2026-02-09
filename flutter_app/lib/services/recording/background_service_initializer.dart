import 'package:flutter_background_service/flutter_background_service.dart';
import 'background_recording_handler.dart';

/// バックグラウンドサービスの初期化
class BackgroundServiceInitializer {
  static Future<void> initialize() async {
    final service = FlutterBackgroundService();

    await service.configure(
      androidConfiguration: AndroidConfiguration(
        onStart: onStart,
        autoStart: false,
        isForegroundMode: true,
        notificationChannelId: 'recording_channel',
        initialNotificationTitle: '録音アプリ',
        initialNotificationContent: '録音準備中...',
        foregroundServiceNotificationId: 888,
        foregroundServiceTypes: [AndroidForegroundType.microphone],
      ),
      iosConfiguration: IosConfiguration(
        autoStart: false,
        onForeground: onStart,
      ),
    );
  }
}
