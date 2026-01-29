import 'dart:async';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:record/record.dart';
import 'package:uuid/uuid.dart';
import '../../core/constants.dart';

/// 録音サービス
class RecordingService {
  final AudioRecorder _recorder = AudioRecorder();
  final Uuid _uuid = const Uuid();

  Timer? _segmentTimer;
  String? _currentSegmentPath;
  String? _currentSessionId;
  DateTime? _segmentStartTime;
  bool _isRecording = false;

  final StreamController<RecordingEvent> _eventController =
      StreamController<RecordingEvent>.broadcast();

  Stream<RecordingEvent> get events => _eventController.stream;
  bool get isRecording => _isRecording;
  String? get currentSessionId => _currentSessionId;

  /// 録音を開始
  Future<void> startRecording() async {
    if (_isRecording) return;

    // マイク権限確認
    if (!await _recorder.hasPermission()) {
      throw RecordingException('マイクの権限がありません');
    }

    _currentSessionId = _uuid.v4();
    _isRecording = true;

    await _startNewSegment();
    _eventController.add(RecordingStarted(_currentSessionId!));
  }

  /// 録音を停止
  Future<void> stopRecording() async {
    if (!_isRecording) return;

    _segmentTimer?.cancel();
    _segmentTimer = null;

    final path = await _recorder.stop();
    _isRecording = false;

    if (path != null && _currentSegmentPath != null) {
      _eventController.add(SegmentCompleted(
        sessionId: _currentSessionId!,
        filePath: path,
        startTime: _segmentStartTime!,
        endTime: DateTime.now(),
        reason: SegmentReason.manual,
      ));
    }

    _eventController.add(RecordingStopped(_currentSessionId!));
    _currentSessionId = null;
  }

  /// 新しいセグメントを開始
  Future<void> _startNewSegment() async {
    final dir = await getApplicationDocumentsDirectory();
    final segmentId = _uuid.v4();
    _currentSegmentPath = p.join(dir.path, 'recordings', '$segmentId.m4a');

    // フォルダ作成
    final recordingsDir = Directory(p.join(dir.path, 'recordings'));
    if (!await recordingsDir.exists()) {
      await recordingsDir.create(recursive: true);
    }

    _segmentStartTime = DateTime.now();

    await _recorder.start(
      RecordConfig(
        encoder: AudioEncoder.aacLc,
        sampleRate: AppConstants.sampleRate,
        bitRate: AppConstants.bitRate,
      ),
      path: _currentSegmentPath!,
    );

    // セグメントタイマー設定
    _segmentTimer?.cancel();
    _segmentTimer = Timer(
      Duration(minutes: AppConstants.segmentDurationMinutes),
      _onSegmentTimeout,
    );
  }

  /// セグメントタイムアウト
  Future<void> _onSegmentTimeout() async {
    if (!_isRecording) return;

    final path = await _recorder.stop();

    if (path != null) {
      _eventController.add(SegmentCompleted(
        sessionId: _currentSessionId!,
        filePath: path,
        startTime: _segmentStartTime!,
        endTime: DateTime.now(),
        reason: SegmentReason.duration,
      ));
    }

    // 次のセグメント開始
    await _startNewSegment();
  }

  /// リソース解放
  void dispose() {
    _segmentTimer?.cancel();
    _recorder.dispose();
    _eventController.close();
  }
}

/// 録音イベント基底クラス
sealed class RecordingEvent {}

class RecordingStarted extends RecordingEvent {
  final String sessionId;
  RecordingStarted(this.sessionId);
}

class RecordingStopped extends RecordingEvent {
  final String sessionId;
  RecordingStopped(this.sessionId);
}

class SegmentCompleted extends RecordingEvent {
  final String sessionId;
  final String filePath;
  final DateTime startTime;
  final DateTime endTime;
  final SegmentReason reason;

  SegmentCompleted({
    required this.sessionId,
    required this.filePath,
    required this.startTime,
    required this.endTime,
    required this.reason,
  });
}

enum SegmentReason { duration, silence, manual }

class RecordingException implements Exception {
  final String message;
  RecordingException(this.message);

  @override
  String toString() => message;
}
