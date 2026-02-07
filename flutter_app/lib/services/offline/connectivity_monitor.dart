import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'offline_queue_service.dart';

/// 接続監視サービス
class ConnectivityMonitor {
  final OfflineQueueService _queueService;
  final Connectivity _connectivity;
  StreamSubscription<List<ConnectivityResult>>? _subscription;
  bool _wasOffline = false;

  ConnectivityMonitor({
    required OfflineQueueService queueService,
    Connectivity? connectivity,
  })  : _queueService = queueService,
        _connectivity = connectivity ?? Connectivity();

  /// 監視開始
  void startMonitoring() {
    _subscription = _connectivity.onConnectivityChanged.listen((results) {
      _onConnectivityChanged(results);
    });

    // 初回状態確認
    _connectivity.checkConnectivity().then(_onConnectivityChanged);
  }

  void _onConnectivityChanged(List<ConnectivityResult> results) {
    final isOnline = results.any((result) =>
      result == ConnectivityResult.mobile ||
      result == ConnectivityResult.wifi ||
      result == ConnectivityResult.ethernet
    );

    if (isOnline && _wasOffline) {
      // オフライン→オンライン復帰時にキューをフラッシュ
      _queueService.flush();
    }

    _wasOffline = !isOnline;
  }

  /// 監視停止
  void stopMonitoring() {
    _subscription?.cancel();
    _subscription = null;
  }
}
