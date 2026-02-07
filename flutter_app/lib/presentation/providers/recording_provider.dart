import 'dart:async';
import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../../core/constants.dart';
import '../../services/recording/recording_service.dart';
import '../../services/transcribe/transcribe_service.dart';
import '../../services/offline/offline_queue_service.dart';

/// 録音サービスプロバイダー
final recordingServiceProvider = Provider<RecordingService>((ref) {
  final service = RecordingService();
  ref.onDispose(() => service.dispose());
  return service;
});

/// 文字起こしサービスプロバイダー
final transcribeServiceProvider = Provider<TranscribeService>((ref) {
  return TranscribeService(baseUrl: ApiConfig.baseUrl);
});

/// オフラインキューサービスプロバイダー
final offlineQueueServiceProvider = Provider<OfflineQueueService>((ref) {
  return OfflineQueueService();
});

/// デバイスIDプロバイダー（shared_preferencesで永続化）
final deviceIdProvider = FutureProvider<String>((ref) async {
  final prefs = await SharedPreferences.getInstance();
  String? deviceId = prefs.getString('device_id');

  if (deviceId == null) {
    deviceId = const Uuid().v4();
    await prefs.setString('device_id', deviceId);
  }

  return deviceId;
});

/// 録音状態
class RecordingState {
  final bool isRecording;
  final String? sessionId;
  final Duration elapsed;
  final int segmentCount;
  final int transcribedCount;
  final String? error;
  final String? lastTranscript;

  const RecordingState({
    this.isRecording = false,
    this.sessionId,
    this.elapsed = Duration.zero,
    this.segmentCount = 0,
    this.transcribedCount = 0,
    this.error,
    this.lastTranscript,
  });

  RecordingState copyWith({
    bool? isRecording,
    String? sessionId,
    bool clearSessionId = false,
    Duration? elapsed,
    int? segmentCount,
    int? transcribedCount,
    String? error,
    String? lastTranscript,
  }) {
    return RecordingState(
      isRecording: isRecording ?? this.isRecording,
      sessionId: clearSessionId ? null : (sessionId ?? this.sessionId),
      elapsed: elapsed ?? this.elapsed,
      segmentCount: segmentCount ?? this.segmentCount,
      transcribedCount: transcribedCount ?? this.transcribedCount,
      error: error,
      lastTranscript: lastTranscript ?? this.lastTranscript,
    );
  }
}

/// 録音状態Notifier
class RecordingNotifier extends StateNotifier<RecordingState> {
  final RecordingService _recordingService;
  final TranscribeService _transcribeService;
  final OfflineQueueService _offlineQueueService;
  final String _deviceId;
  StreamSubscription? _eventSubscription;
  Timer? _elapsedTimer;
  DateTime? _startTime;

  RecordingNotifier(
    this._recordingService,
    this._transcribeService,
    this._offlineQueueService,
    this._deviceId,
  ) : super(const RecordingState()) {
    _eventSubscription = _recordingService.events.listen(_onEvent);
  }

  void _onEvent(RecordingEvent event) {
    switch (event) {
      case RecordingStarted(:final sessionId):
        _startTime = DateTime.now();
        _startElapsedTimer();
        state = state.copyWith(
          isRecording: true,
          sessionId: sessionId,
          segmentCount: 0,
          transcribedCount: 0,
        );
      case RecordingStopped():
        _stopElapsedTimer();
        state = state.copyWith(
          isRecording: false,
          elapsed: Duration.zero,
          clearSessionId: true,
        );
      case SegmentCompleted(
          :final sessionId,
          :final filePath,
          :final startTime,
          :final endTime
        ):
        state = state.copyWith(
          segmentCount: state.segmentCount + 1,
        );
        // 文字起こしを非同期で実行
        _transcribeAndDelete(
          filePath: filePath,
          sessionId: sessionId,
          segmentNo: state.segmentCount,
          startTime: startTime,
          endTime: endTime,
        );
    }
  }

  /// 文字起こしして、成功したらローカルファイルを削除
  Future<void> _transcribeAndDelete({
    required String filePath,
    required String sessionId,
    required int segmentNo,
    required DateTime startTime,
    required DateTime endTime,
  }) async {
    try {
      final result = await _transcribeService.transcribe(
        filePath: filePath,
        deviceId: _deviceId,
        sessionId: sessionId,
        segmentNo: segmentNo,
        startAt: startTime.toUtc(),
        endAt: endTime.toUtc(),
      );

      // 文字起こし成功 → ローカルファイル削除
      final file = File(filePath);
      if (await file.exists()) {
        await file.delete();
      }

      state = state.copyWith(
        transcribedCount: state.transcribedCount + 1,
        lastTranscript: result.text,
      );
    } catch (e) {
      // エラー時はファイルを保持し、オフラインキューに追加
      await _offlineQueueService.enqueue(
        endpoint: '/api/segments/transcribe',
        method: 'POST',
        payload: {
          'deviceId': _deviceId,
          'sessionId': sessionId,
          'segmentNo': segmentNo,
          'startAt': startTime.toUtc().toIso8601String(),
          'endAt': endTime.toUtc().toIso8601String(),
          'filePath': filePath, // 後でアップロードするためパスを保持
        },
      );
      state = state.copyWith(error: '文字起こし失敗（キューに追加）: $e');
    }
  }

  void _startElapsedTimer() {
    _elapsedTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_startTime != null) {
        state = state.copyWith(
          elapsed: DateTime.now().difference(_startTime!),
        );
      }
    });
  }

  void _stopElapsedTimer() {
    _elapsedTimer?.cancel();
    _elapsedTimer = null;
    _startTime = null;
  }

  Future<void> startRecording() async {
    try {
      await _recordingService.startRecording();
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  Future<void> stopRecording() async {
    try {
      await _recordingService.stopRecording();
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  @override
  void dispose() {
    _eventSubscription?.cancel();
    _stopElapsedTimer();
    super.dispose();
  }
}

/// 録音プロバイダー
final recordingNotifierProvider =
    StateNotifierProvider<RecordingNotifier, RecordingState>((ref) {
  final recordingService = ref.watch(recordingServiceProvider);
  final transcribeService = ref.watch(transcribeServiceProvider);
  final offlineQueueService = ref.watch(offlineQueueServiceProvider);
  final deviceIdAsync = ref.watch(deviceIdProvider);

  // デバイスIDが取得できるまで待機
  final deviceId = deviceIdAsync.when(
    data: (id) => id,
    loading: () => 'loading',
    error: (_, __) => const Uuid().v4(),
  );

  return RecordingNotifier(
    recordingService,
    transcribeService,
    offlineQueueService,
    deviceId,
  );
});
