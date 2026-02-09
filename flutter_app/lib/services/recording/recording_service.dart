import 'dart:async';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import 'permission_service.dart';

/// 録音サービス（Background Service IPCプロキシ）
///
/// RecordingEvent ストリームAPIは変更なし。
/// RecordingNotifier は変更不要。
class RecordingService {
  final FlutterBackgroundService _service = FlutterBackgroundService();
  final Uuid _uuid = const Uuid();

  bool _isRecording = false;
  String? _currentSessionId;

  final StreamController<RecordingEvent> _eventController =
      StreamController<RecordingEvent>.broadcast();

  StreamSubscription? _startedSub;
  StreamSubscription? _segmentSub;
  StreamSubscription? _stoppedSub;
  StreamSubscription? _errorSub;

  Stream<RecordingEvent> get events => _eventController.stream;
  bool get isRecording => _isRecording;
  String? get currentSessionId => _currentSessionId;

  RecordingService() {
    _listenToServiceEvents();
  }

  void _listenToServiceEvents() {
    _startedSub = _service.on('onRecordingStarted').listen((event) {
      if (event == null) return;
      _isRecording = true;
      _currentSessionId = event['sessionId'] as String;
      _eventController.add(RecordingStarted(_currentSessionId!));
    });

    _segmentSub = _service.on('onSegmentCompleted').listen((event) {
      if (event == null) return;
      _eventController.add(SegmentCompleted(
        sessionId: event['sessionId'] as String,
        filePath: event['filePath'] as String,
        startTime: DateTime.parse(event['startTime'] as String),
        endTime: DateTime.parse(event['endTime'] as String),
        reason: _parseReason(event['reason'] as String),
      ));
    });

    _stoppedSub = _service.on('onRecordingStopped').listen((event) {
      if (event == null) return;
      _isRecording = false;
      _eventController.add(RecordingStopped(event['sessionId'] as String));
      _currentSessionId = null;
      // M4: 録音停止後にバックグラウンドサービスを停止
      _service.invoke('stopService');
    });

    // H3: バックグラウンドからのエラー通知を受信
    _errorSub = _service.on('onError').listen((event) {
      if (event == null) return;
      _eventController.add(RecordingError(event['message'] as String));
    });
  }

  SegmentReason _parseReason(String reason) {
    switch (reason) {
      case 'duration':
        return SegmentReason.duration;
      case 'silence':
        return SegmentReason.silence;
      case 'manual':
      default:
        return SegmentReason.manual;
    }
  }

  /// 録音を開始
  Future<void> startRecording() async {
    if (_isRecording) return;

    // 権限チェック
    final permResult = await PermissionService.requestRecordingPermissions();
    if (!permResult.granted) {
      throw RecordingException(permResult.message ?? 'マイクの権限がありません');
    }

    final sessionId = _uuid.v4();

    // recordings dirパスをSharedPreferencesから取得
    final prefs = await SharedPreferences.getInstance();
    final recordingsDir = prefs.getString('recordings_dir');
    if (recordingsDir == null || recordingsDir.isEmpty) {
      throw RecordingException('録音ディレクトリが設定されていません');
    }

    // バックグラウンドサービス起動
    await _service.startService();

    // C1: readyハンドシェイク — サービスが'ready'を発火するまで待機
    final readyCompleter = Completer<void>();
    late StreamSubscription readySub;
    readySub = _service.on('ready').listen((_) {
      if (!readyCompleter.isCompleted) {
        readyCompleter.complete();
      }
      readySub.cancel();
    });

    // 5秒タイムアウト
    try {
      await readyCompleter.future.timeout(const Duration(seconds: 5));
    } on TimeoutException {
      readySub.cancel();
      throw RecordingException('バックグラウンドサービスの起動がタイムアウトしました');
    }

    _service.invoke('start', {
      'sessionId': sessionId,
      'recordingsDir': recordingsDir,
    });
  }

  /// 録音を停止
  Future<void> stopRecording() async {
    if (!_isRecording) return;
    _service.invoke('stop');
  }

  /// C3: バックグラウンドサービスの録音状態を同期
  Future<bool> syncBackgroundState() async {
    final running = await _service.isRunning();
    if (!running) {
      // サービスが停止している場合はローカル状態もリセット
      if (_isRecording) {
        _isRecording = false;
        _currentSessionId = null;
      }
      return false;
    }

    // サービスに現在の状態を問い合わせ
    final stateCompleter = Completer<Map<String, dynamic>?>();
    late StreamSubscription stateSub;
    stateSub = _service.on('stateResponse').listen((event) {
      if (!stateCompleter.isCompleted) {
        stateCompleter.complete(event);
      }
      stateSub.cancel();
    });

    _service.invoke('getState');

    try {
      final bgState = await stateCompleter.future.timeout(
        const Duration(seconds: 3),
      );
      if (bgState != null) {
        _isRecording = bgState['isRecording'] as bool? ?? false;
        _currentSessionId = bgState['sessionId'] as String?;
      }
    } on TimeoutException {
      stateSub.cancel();
      // タイムアウト時はisRunningの結果を信頼
    }

    return _isRecording;
  }

  /// リソース解放
  void dispose() {
    _startedSub?.cancel();
    _segmentSub?.cancel();
    _stoppedSub?.cancel();
    _errorSub?.cancel();
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

/// H3: バックグラウンドエラーイベント
class RecordingError extends RecordingEvent {
  final String message;
  RecordingError(this.message);
}

enum SegmentReason { duration, silence, manual }

class RecordingException implements Exception {
  final String message;
  RecordingException(this.message);

  @override
  String toString() => message;
}
