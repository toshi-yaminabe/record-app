import 'dart:async';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_logger.dart';
import '../../core/constants.dart';
import '../../data/repositories/authenticated_client.dart';
import '../../services/offline/offline_queue_service.dart';
import '../../services/offline/pending_transcribe_store.dart';
import '../../services/recording/recording_service.dart';
import '../../services/transcribe/transcribe_service.dart';
import '../../core/transcribe_mode.dart';
import 'transcribe_mode_provider.dart';

/// 録音サービスプロバイダー
final recordingServiceProvider = Provider<RecordingService>((ref) {
  final service = RecordingService();
  ref.onDispose(() => service.dispose());
  return service;
});

/// 文字起こしサービスプロバイダー
/// main.dartのProviderScope.overridesでインスタンスを注入する。
final transcribeServiceProvider = Provider<TranscribeService>((ref) {
  return TranscribeService(baseUrl: ApiConfig.baseUrl);
});

/// 認証済みHTTPクライアントプロバイダー
/// main.dartのProviderScope.overridesでインスタンスを注入する。
final authenticatedClientProvider = Provider<AuthenticatedClient>((ref) {
  return AuthenticatedClient(baseUrl: ApiConfig.baseUrl);
});

/// オフラインキューサービスプロバイダー
/// main.dartのProviderScope.overridesでインスタンスを注入する。
final offlineQueueServiceProvider = Provider<OfflineQueueService>((ref) {
  throw UnimplementedError(
    'offlineQueueServiceProvider must be overridden in ProviderScope',
  );
});

/// 文字起こしリトライ専用ストアプロバイダー
/// main.dartのProviderScope.overridesでインスタンスを注入する。
final pendingTranscribeStoreProvider = Provider<PendingTranscribeStore>((ref) {
  throw UnimplementedError(
    'pendingTranscribeStoreProvider must be overridden in ProviderScope',
  );
});

/// デバイスIDプロバイダー
/// main.dartで事前取得した値をProviderScope.overridesで注入する。
/// 直接アクセスすると例外が発生する（override必須）。
final deviceIdProvider = Provider<String>((ref) {
  throw UnimplementedError(
    'deviceIdProvider must be overridden in ProviderScope with a pre-resolved value',
  );
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
  final Ref _ref;

  StreamSubscription? _eventSubscription;
  Timer? _elapsedTimer;
  DateTime? _startTime;

  RecordingNotifier(
    this._recordingService,
    this._transcribeService,
    this._pendingStore,
    this._deviceId,
    this._ref,
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
          :final endTime,
          :final segmentNo
        ):
        AppLogger.recording(
          'SegmentCompleted sessionId=$sessionId filePath=$filePath segmentNo=$segmentNo',
        );
        state = state.copyWith(segmentCount: segmentNo);
        _transcribeAndDelete(
          filePath: filePath,
          sessionId: sessionId,
          segmentNo: segmentNo,
          startTime: startTime,
          endTime: endTime,
        );
      case RecordingError(:final message):
        AppLogger.recording('RecordingError: $message');
        state = state.copyWith(error: message);
    }
  }

  Future<void> _transcribeAndDelete({
    required String filePath,
    required String sessionId,
    required int segmentNo,
    required DateTime startTime,
    required DateTime endTime,
  }) async {
    final mode = _ref.read(transcribeModeProvider) ?? TranscribeMode.server;
    AppLogger.recording(
      'transcribeAndDelete: filePath=$filePath sessionId=$sessionId mode=${mode.name}',
    );

    try {
      final result = await _transcribeService.transcribe(
        filePath: filePath,
        deviceId: _deviceId,
        sessionId: sessionId,
        segmentNo: segmentNo,
        startAt: startTime.toUtc(),
        endAt: endTime.toUtc(),
        mode: mode,
      );

      final file = File(filePath);
      if (await file.exists()) {
        await file.delete();
      }

      state = state.copyWith(
        sessionId: result.sessionId ?? state.sessionId,
        transcribedCount: state.transcribedCount + 1,
        lastTranscript: result.text,
      );
    } catch (e) {
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
        state = state.copyWith(elapsed: DateTime.now().difference(_startTime!));
      }
    });
  }

  void _stopElapsedTimer() {
    _elapsedTimer?.cancel();
    _elapsedTimer = null;
    _startTime = null;
  }

  Future<void> startRecording() async {
    if (_deviceId.isEmpty) {
      AppLogger.recording('startRecording BLOCKED: deviceId is empty');
      state = state.copyWith(
        error: 'デバイスIDが取得できていません。アプリを再起動してください。',
      );
      return;
    }

    try {
      await _recordingService.startRecording();
    } catch (e) {
      AppLogger.recording('startRecording FAILED', error: e);
      state = state.copyWith(error: e.toString());
    }
  }

  Future<void> stopRecording() async {
    try {
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

final recordingNotifierProvider =
    StateNotifierProvider<RecordingNotifier, RecordingState>((ref) {
  final recordingService = ref.watch(recordingServiceProvider);
  final transcribeService = ref.watch(transcribeServiceProvider);
  final pendingStore = ref.watch(pendingTranscribeStoreProvider);
  final deviceId = ref.watch(deviceIdProvider);

  return RecordingNotifier(
    recordingService,
    transcribeService,
    pendingStore,
    deviceId,
    ref,
  );
});
