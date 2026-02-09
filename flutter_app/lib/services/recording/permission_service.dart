import 'dart:io';
import 'package:permission_handler/permission_handler.dart';

/// 権限リクエストサービス
class PermissionService {
  /// 録音に必要な権限をリクエスト
  /// マイク権限は必須、通知権限はオプション（警告のみ）
  static Future<PermissionResult> requestRecordingPermissions() async {
    // マイク権限
    final micStatus = await Permission.microphone.request();
    if (!micStatus.isGranted) {
      return const PermissionResult(
        granted: false,
        message: 'マイクの権限が必要です',
      );
    }

    // 通知権限 (Android 13+)
    bool notificationGranted = true;
    if (Platform.isAndroid) {
      final notifStatus = await Permission.notification.request();
      notificationGranted = notifStatus.isGranted;
    }

    return PermissionResult(
      granted: true,
      notificationGranted: notificationGranted,
      message: notificationGranted
          ? null
          : '通知権限がないため、バックグラウンド録音中の通知が表示されません',
    );
  }
}

class PermissionResult {
  final bool granted;
  final bool notificationGranted;
  final String? message;

  const PermissionResult({
    required this.granted,
    this.notificationGranted = true,
    this.message,
  });
}
