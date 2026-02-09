import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// 通知チャネルの初期化
class NotificationChannelSetup {
  static Future<void> initialize() async {
    final flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();

    // Android通知チャネル作成
    const androidChannel = AndroidNotificationChannel(
      'recording_channel',
      '録音サービス',
      description: 'バックグラウンド録音中の常駐通知',
      importance: Importance.low, // 音なし・バイブなし
      enableVibration: false,
      playSound: false,
    );

    await flutterLocalNotificationsPlugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(androidChannel);

    // 初期化
    const initSettings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
    );

    await flutterLocalNotificationsPlugin.initialize(initSettings);
  }
}
