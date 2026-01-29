import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/recording/recording_service.dart';

/// 録音サービスプロバイダー
final recordingServiceProvider = Provider<RecordingService>((ref) {
  final service = RecordingService();
  ref.onDispose(() => service.dispose());
  return service;
});

/// 録音状態
class RecordingState {
  final bool isRecording;
  final String? sessionId;
  final Duration elapsed;
  final int segmentCount;
  final String? error;

  const RecordingState({
    this.isRecording = false,
    this.sessionId,
    this.elapsed = Duration.zero,
    this.segmentCount = 0,
    this.error,
  });

  RecordingState copyWith({
    bool? isRecording,
    String? sessionId,
    Duration? elapsed,
    int? segmentCount,
    String? error,
  }) {
    return RecordingState(
      isRecording: isRecording ?? this.isRecording,
      sessionId: sessionId ?? this.sessionId,
      elapsed: elapsed ?? this.elapsed,
      segmentCount: segmentCount ?? this.segmentCount,
      error: error,
    );
  }
}

/// 録音状態Notifier
class RecordingNotifier extends StateNotifier<RecordingState> {
  final RecordingService _service;
  StreamSubscription? _eventSubscription;
  Timer? _elapsedTimer;
  DateTime? _startTime;

  RecordingNotifier(this._service) : super(const RecordingState()) {
    _eventSubscription = _service.events.listen(_onEvent);
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
        );
      case RecordingStopped():
        _stopElapsedTimer();
        state = state.copyWith(
          isRecording: false,
          elapsed: Duration.zero,
        );
      case SegmentCompleted():
        state = state.copyWith(
          segmentCount: state.segmentCount + 1,
        );
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
      await _service.startRecording();
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  Future<void> stopRecording() async {
    try {
      await _service.stopRecording();
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
  final service = ref.watch(recordingServiceProvider);
  return RecordingNotifier(service);
});
