import 'dart:async';
import 'dart:developer' as developer;
import 'dart:io';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:record/record.dart';
import 'package:uuid/uuid.dart';
import '../../core/constants.dart';

/// バックグラウンドisolateのエントリポイント
///
/// NOTE: バックグラウンドisolateでは AppLogger は使えない
/// （path_provider依存のファイル書き込みが不可能）。
/// developer.log() で直接ログ出力する。
@pragma('vm:entry-point')
Future<void> onStart(ServiceInstance service) async {
  final handler = _BackgroundRecordingHandler(service);

  service.on('start').listen((event) async {
    if (event == null) return;
    final sessionId = event['sessionId'] as String;
    final recordingsDir = event['recordingsDir'] as String;
    await handler.startRecording(sessionId, recordingsDir);
  });

  service.on('stop').listen((_) async {
    await handler.stopRecording();
  });

  service.on('stopService').listen((_) async {
    await handler.stopRecording();
    await service.stopSelf();
  });

  // C3: 状態問い合わせリスナー
  service.on('getState').listen((_) {
    service.invoke('stateResponse', {
      'isRecording': handler.isRecording,
      'sessionId': handler.currentSessionId,
    });
  });

  // C1: readyハンドシェイク — サービス準備完了を通知
  service.invoke('ready');
}

class _BackgroundRecordingHandler {
  final ServiceInstance _service;
  final AudioRecorder _recorder = AudioRecorder();
  final Uuid _uuid = const Uuid();

  Timer? _segmentTimer;
  String? _currentSegmentPath;
  String? _currentSessionId;
  String? _recordingsDir;
  DateTime? _segmentStartTime;
  bool _isRecording = false;
  int _segmentCount = 0;

  _BackgroundRecordingHandler(this._service);

  // C3: 外部から状態を参照可能に
  bool get isRecording => _isRecording;
  String? get currentSessionId => _currentSessionId;

  void _log(String message, {Object? error}) {
    developer.log('[REC-BG] $message',
        name: 'record-app', error: error);
  }

  Future<void> startRecording(String sessionId, String recordingsDir) async {
    if (_isRecording) return;

    _log('startRecording sessionId=$sessionId');
    _currentSessionId = sessionId;
    _recordingsDir = recordingsDir;
    _isRecording = true;
    _segmentCount = 0;

    await _startNewSegment();

    _service.invoke('onRecordingStarted', {
      'sessionId': sessionId,
    });
  }

  Future<void> stopRecording() async {
    if (!_isRecording) return;

    // C2: sessionIdをローカル変数にキャプチャ
    final sessionId = _currentSessionId;
    if (sessionId == null) return;

    _log('stopRecording sessionId=$sessionId');

    _segmentTimer?.cancel();
    _segmentTimer = null;

    final path = await _recorder.stop();
    _isRecording = false;

    if (path != null && _currentSegmentPath != null) {
      _segmentCount++;
      _log('segment completed path=$path segmentNo=$_segmentCount');
      _service.invoke('onSegmentCompleted', {
        'sessionId': sessionId,
        'filePath': path,
        'startTime': _segmentStartTime!.toUtc().toIso8601String(),
        'endTime': DateTime.now().toUtc().toIso8601String(),
        'reason': 'manual',
        'segmentNo': _segmentCount,
      });
    }

    _service.invoke('onRecordingStopped', {
      'sessionId': sessionId,
    });

    _currentSessionId = null;
  }

  Future<void> _startNewSegment() async {
    final segmentId = _uuid.v4();
    final dir = Directory(_recordingsDir!);
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }

    _currentSegmentPath = '${_recordingsDir!}/$segmentId.m4a';
    _segmentStartTime = DateTime.now();

    await _recorder.start(
      RecordConfig(
        encoder: AudioEncoder.aacLc,
        sampleRate: AppConstants.sampleRate,
        bitRate: AppConstants.bitRate,
      ),
      path: _currentSegmentPath!,
    );

    _segmentTimer?.cancel();
    _segmentTimer = Timer(
      Duration(minutes: AppConstants.segmentDurationMinutes),
      _onSegmentTimeout,
    );
  }

  // H3: セグメントタイムアウトをtry-catchで保護
  Future<void> _onSegmentTimeout() async {
    if (!_isRecording) return;

    try {
      final path = await _recorder.stop();

      if (path != null) {
        _segmentCount++;
        _log('segment completed path=$path segmentNo=$_segmentCount (duration)');
        _service.invoke('onSegmentCompleted', {
          'sessionId': _currentSessionId!,
          'filePath': path,
          'startTime': _segmentStartTime!.toUtc().toIso8601String(),
          'endTime': DateTime.now().toUtc().toIso8601String(),
          'reason': 'duration',
          'segmentNo': _segmentCount,
        });
      }

      await _startNewSegment();
    } catch (e) {
      _log('onSegmentTimeout ERROR', error: e);
      // エラー時にUI側に通知
      _service.invoke('onError', {
        'message': 'セグメント処理エラー: $e',
      });
    }
  }
}
