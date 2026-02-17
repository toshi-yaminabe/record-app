import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../../core/app_logger.dart';
import '../transcribe/local_transcribe_sync_service.dart';
import 'offline_queue_service.dart';
import 'transcribe_retry_service.dart';

/// 接続監視サービス
class ConnectivityMonitor {
  final OfflineQueueService _queueService;
  final TranscribeRetryService? _transcribeRetryService;
  final LocalTranscribeSyncService? _localTranscribeSyncService;
  final Connectivity _connectivity;
  StreamSubscription<List<ConnectivityResult>>? _subscription;
  bool _wasOffline = false;

  /// デバウンスタイマー（接続イベントの連続発火を抑制）
  Timer? _debounceTimer;

  /// デバウンス遅延（ミリ秒）
  static const int _debounceDurationMs = 1000;

  ConnectivityMonitor({
    required OfflineQueueService queueService,
    TranscribeRetryService? transcribeRetryService,
    LocalTranscribeSyncService? localTranscribeSyncService,
    Connectivity? connectivity,
  })  : _queueService = queueService,
        _transcribeRetryService = transcribeRetryService,
        _localTranscribeSyncService = localTranscribeSyncService,
        _connectivity = connectivity ?? Connectivity();

  /// 監視開始
  void startMonitoring() {
    _subscription = _connectivity.onConnectivityChanged.listen((results) {
      _onConnectivityChangedDebounced(results);
    });

    // 初回状態確認（エラーハンドリング付き）
    _connectivity.checkConnectivity().then(_onConnectivityChanged).catchError(
        (Object error, StackTrace stack) {
      AppLogger.lifecycle('initial connectivity check failed',
          error: error, stack: stack);
    });
  }

  /// デバウンス付き接続変更ハンドラ
  void _onConnectivityChangedDebounced(List<ConnectivityResult> results) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(
      const Duration(milliseconds: _debounceDurationMs),
      () => _onConnectivityChanged(results),
    );
  }

  /// 接続変更処理
  Future<void> _onConnectivityChanged(
      List<ConnectivityResult> results) async {
    final isOnline = results.any((result) =>
        result == ConnectivityResult.mobile ||
        result == ConnectivityResult.wifi ||
        result == ConnectivityResult.ethernet);

    AppLogger.lifecycle(
        'connectivity changed: $results wasOffline=$_wasOffline');

    if (isOnline && _wasOffline) {
      // オフライン→オンライン復帰時のみキューをフラッシュ
      AppLogger.queue('flush triggered by connectivity restore');
      try {
        await _queueService.flush();
        await _transcribeRetryService?.retryPending();
        await _localTranscribeSyncService?.syncPending();
      } catch (e, stackTrace) {
        AppLogger.queue('flush/retry failed on connectivity restore',
            error: e, stack: stackTrace);
      }
    }

    _wasOffline = !isOnline;
  }

  /// 監視停止
  void stopMonitoring() {
    _debounceTimer?.cancel();
    _debounceTimer = null;
    _subscription?.cancel();
    _subscription = null;
  }
}
