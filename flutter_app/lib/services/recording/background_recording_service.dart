import 'dart:async';
import 'dart:io';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:record/record.dart';
import 'package:uuid/uuid.dart';
import '../../core/constants.dart';

/// バックグラウンド録音サービス
class BackgroundRecordingService {
  static const String _notificationChannelId = 'recording_channel';
  static const int _notificationId = 888;

  static final FlutterLocalNotificationsPlugin _notifications =
      FlutterLocalNotificationsPlugin();

  /// サービスを初期化
  static Future<void> initialize() async {
    final service = FlutterBackgroundService();

    // 通知チャンネル設定 (Android)
    const androidChannel = AndroidNotificationChannel(
      _notificationChannelId,
      '録音サービス',
      description: 'バックグラウンド録音中の通知',
      importance: Importance.low,
    );

    await _notifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(androidChannel);

    await service.configure(
      androidConfiguration: AndroidConfiguration(
        onStart: _onStart,
        autoStart: false,
        isForegroundMode: true,
        notificationChannelId: _notificationChannelId,
        initialNotificationTitle: '録音アプリ',
        initialNotificationContent: '録音準備中...',
        foregroundServiceNotificationId: _notificationId,
        foregroundServiceTypes: [AndroidForegroundType.microphone],
      ),
      iosConfiguration: IosConfiguration(
        autoStart: false,
        onForeground: _onStart,
        onBackground: _onIosBackground,
      ),
    );
  }

  /// サービスを開始
  static Future<void> startService() async {
    final service = FlutterBackgroundService();
    await service.startService();
  }

  /// サービスを停止
  static Future<void> stopService() async {
    final service = FlutterBackgroundService();
    service.invoke('stop');
  }

  /// 録音を開始
  static void startRecording(String sessionId) {
    final service = FlutterBackgroundService();
    service.invoke('startRecording', {'sessionId': sessionId});
  }

  /// 録音を停止
  static void stopRecording() {
    final service = FlutterBackgroundService();
    service.invoke('stopRecording');
  }

  /// イベントストリームを取得
  static Stream<Map<String, dynamic>?> get events {
    final service = FlutterBackgroundService();
    return service.on('recordingEvent');
  }
}

/// バックグラウンドサービスのエントリポイント
@pragma('vm:entry-point')
Future<void> _onStart(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();

  final recorder = AudioRecorder();
  final uuid = const Uuid();
  Timer? segmentTimer;
  String? currentSessionId;
  String? currentSegmentPath;
  DateTime? segmentStartTime;
  bool isRecording = false;

  // 録音ディレクトリを取得
  Future<String> getRecordingsDir() async {
    final dir = await getApplicationDocumentsDirectory();
    final recordingsDir = Directory(p.join(dir.path, 'recordings'));
    if (!await recordingsDir.exists()) {
      await recordingsDir.create(recursive: true);
    }
    return recordingsDir.path;
  }

  // 新しいセグメントを開始
  Future<void> startNewSegment() async {
    final recordingsDir = await getRecordingsDir();
    final segmentId = uuid.v4();
    currentSegmentPath = p.join(recordingsDir, '$segmentId.m4a');
    segmentStartTime = DateTime.now();

    await recorder.start(
      RecordConfig(
        encoder: AudioEncoder.aacLc,
        sampleRate: AppConstants.sampleRate,
        bitRate: AppConstants.bitRate,
      ),
      path: currentSegmentPath!,
    );

    // セグメントタイマー
    segmentTimer?.cancel();
    segmentTimer = Timer(
      Duration(minutes: AppConstants.segmentDurationMinutes),
      () async {
        if (!isRecording) return;

        final path = await recorder.stop();
        if (path != null) {
          service.invoke('recordingEvent', {
            'type': 'segmentCompleted',
            'sessionId': currentSessionId,
            'filePath': path,
            'startTime': segmentStartTime?.toIso8601String(),
            'endTime': DateTime.now().toIso8601String(),
            'reason': 'duration',
          });
        }

        // 次のセグメント開始
        await startNewSegment();
      },
    );
  }

  // 録音開始コマンド
  service.on('startRecording').listen((event) async {
    if (isRecording) return;

    currentSessionId = event?['sessionId'] as String?;
    if (currentSessionId == null) return;

    if (!await recorder.hasPermission()) {
      service.invoke('recordingEvent', {
        'type': 'error',
        'message': 'マイクの権限がありません',
      });
      return;
    }

    isRecording = true;
    await startNewSegment();

    // 通知を更新
    if (service is AndroidServiceInstance) {
      service.setForegroundNotificationInfo(
        title: '録音中',
        content: '録音を継続しています',
      );
    }

    service.invoke('recordingEvent', {
      'type': 'started',
      'sessionId': currentSessionId,
    });
  });

  // 録音停止コマンド
  service.on('stopRecording').listen((event) async {
    if (!isRecording) return;

    segmentTimer?.cancel();
    segmentTimer = null;

    final path = await recorder.stop();
    isRecording = false;

    if (path != null && currentSegmentPath != null) {
      service.invoke('recordingEvent', {
        'type': 'segmentCompleted',
        'sessionId': currentSessionId,
        'filePath': path,
        'startTime': segmentStartTime?.toIso8601String(),
        'endTime': DateTime.now().toIso8601String(),
        'reason': 'manual',
      });
    }

    service.invoke('recordingEvent', {
      'type': 'stopped',
      'sessionId': currentSessionId,
    });

    currentSessionId = null;
  });

  // サービス停止コマンド
  service.on('stop').listen((event) async {
    if (isRecording) {
      segmentTimer?.cancel();
      await recorder.stop();
    }
    recorder.dispose();
    await service.stopSelf();
  });
}

/// iOS バックグラウンドハンドラー
@pragma('vm:entry-point')
Future<bool> _onIosBackground(ServiceInstance service) async {
  WidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();
  return true;
}
