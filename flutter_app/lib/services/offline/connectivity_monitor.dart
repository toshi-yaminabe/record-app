import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../../core/app_logger.dart';
import 'offline_queue_service.dart';
import 'transcribe_retry_service.dart';

/// 接続監視サービス
class ConnectivityMonitor {
  final OfflineQueueService _queueService;
  final TranscribeRetryService? _transcribeRetryService;
  final Connectivity _connectivity;
  StreamSubscription<List<ConnectivityResult>>? _subscription;
  bool _wasOffline = false;

  ConnectivityMonitor({
    required OfflineQueueService queueService,
    TranscribeRetryService? transcribeRetryService,
    Connectivity? connectivity,
  })  : _queueService = queueService,
        _transcribeRetryService = transcribeRetryService,
        _connectivity = connectivity ?? Connectivity();

  /// 監視開始
  void startMonitoring() {
    _subscription = _connectivity.onConnectivityChanged.listen((results) {
      _onConnectivityChanged(results);
    });

    // 初回状態確認
    _connectivity.checkConnectivity().then(_onConnectivityChanged);
  }

  // H1: flush()をawait + try-catchで保護
  Future<void> _onConnectivityChanged(
      List<ConnectivityResult> results) async {
    final isOnline = results.any((result) =>
        result == ConnectivityResult.mobile ||
        result == ConnectivityResult.wifi ||
        result == ConnectivityResult.ethernet);

    AppLogger.lifecycle(
        'connectivity changed: $results wasOffline=$_wasOffline');

    if (isOnline && _wasOffline) {
      // オフライン→オンライン復帰時にキューをフラッシュ
      AppLogger.queue('flush triggered by connectivity restore');
      try {
        await _queueService.flush();
        // S2: 文字起こしリトライも実行
        await _transcribeRetryService?.retryPending();
      } catch (e, stackTrace) {
        // ログ出力のみ（次回接続時にリトライ）
        AppLogger.queue('flush/retry failed on connectivity restore',
            error: e, stack: stackTrace);
      }
    }

    _wasOffline = !isOnline;
  }

  /// 監視停止
  void stopMonitoring() {
    _subscription?.cancel();
    _subscription = null;
  }
}
