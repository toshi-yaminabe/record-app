import 'dart:async';
import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../../core/app_logger.dart';
import '../../core/constants.dart';
import '../../services/recording/recording_service.dart';
import '../../services/transcribe/transcribe_service.dart';
import '../../services/offline/offline_queue_service.dart';
import '../../services/offline/pending_transcribe_store.dart';

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

/// 文字起こしリトライ専用ストアプロバイダー
final pendingTranscribeStoreProvider =
    Provider<PendingTranscribeStore>((ref) {
  return PendingTranscribeStore();
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
  final PendingTranscribeStore _pendingStore;
  final String _deviceId;
  StreamSubscription? _eventSubscription;
  Timer? _elapsedTimer;
  DateTime? _startTime;

  RecordingNotifier(
    this._recordingService,
    this._transcribeService,
    this._pendingStore,
    this._deviceId,
  ) : super(const RecordingState()) {
    _eventSubscription = _recordingService.events.listen(_onEvent);
  }

  void _onEvent(RecordingEvent event) {
    switch (event) {
      case RecordingStarted(:final sessionId):
        AppLogger.recording('RecordingStarted sessionId=$sessionId');
        _startTime = DateTime.now();
        _startElapsedTimer();
        state = state.copyWith(
          isRecording: true,
          sessionId: sessionId,
          segmentCount: 0,
          transcribedCount: 0,
        );
      case RecordingStopped():
        AppLogger.recording('RecordingStopped');
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
        AppLogger.recording(
            'SegmentCompleted sessionId=$sessionId filePath=$filePath');
        state = state.copyWith(
          segmentCount: state.segmentCount + 1,
        );
        _transcribeAndDelete(
          filePath: filePath,
          sessionId: sessionId,
          segmentNo: state.segmentCount,
          startTime: startTime,
          endTime: endTime,
        );
      case RecordingError(:final message):
        AppLogger.recording('RecordingError: $message');
        state = state.copyWith(error: message);
    }
  }

  /// S2: 文字起こしして、成功したらローカルファイルを削除。
  /// 失敗時はPendingTranscribeStoreに保存（multipartリトライ可能）。
  Future<void> _transcribeAndDelete({
    required String filePath,
    required String sessionId,
    required int segmentNo,
    required DateTime startTime,
    required DateTime endTime,
  }) async {
    AppLogger.recording(
        'transcribeAndDelete: filePath=$filePath sessionId=$sessionId');
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

      AppLogger.recording(
          'transcribe success: transcriptId=${result.transcriptId}');
      state = state.copyWith(
        transcribedCount: state.transcribedCount + 1,
        lastTranscript: result.text,
      );
    } catch (e) {
      // S2: ファイルパスをPendingTranscribeStoreに保存（multipart再送可能）
      AppLogger.recording('transcribe failed, enqueueing retry', error: e);
      await _pendingStore.add(
        filePath: filePath,
        deviceId: _deviceId,
        sessionId: sessionId,
        segmentNo: segmentNo,
        startAt: startTime.toUtc(),
        endAt: endTime.toUtc(),
      );
      state = state.copyWith(error: '文字起こし失敗（リトライキューに追加）: $e');
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
    // H2: deviceIdが未解決の場合は録音をブロック
    if (_deviceId == 'loading') {
      AppLogger.recording(
          'startRecording BLOCKED: deviceId is still loading');
      state = state.copyWith(
          error: 'デバイスIDの取得中です。しばらく待ってから再試行してください。');
      return;
    }

    try {
      AppLogger.recording('startRecording: requesting start');
      await _recordingService.startRecording();
    } catch (e) {
      AppLogger.recording('startRecording FAILED', error: e);
      state = state.copyWith(error: e.toString());
    }
  }

  Future<void> stopRecording() async {
    try {
      AppLogger.recording('stopRecording: requesting stop');
      await _recordingService.stopRecording();
    } catch (e) {
      AppLogger.recording('stopRecording FAILED', error: e);
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
  final pendingStore = ref.watch(pendingTranscribeStoreProvider);
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
    pendingStore,
    deviceId,
  );
});
