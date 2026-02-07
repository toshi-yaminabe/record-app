import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

/// 接続状態プロバイダー
final connectivityProvider = StreamProvider<bool>((ref) {
  final connectivity = Connectivity();

  return connectivity.onConnectivityChanged.map((results) {
    return results.any((result) =>
      result == ConnectivityResult.mobile ||
      result == ConnectivityResult.wifi ||
      result == ConnectivityResult.ethernet
    );
  });
});

/// 現在の接続状態を取得（同期的）
final isOnlineProvider = Provider<bool>((ref) {
  final connectivityAsync = ref.watch(connectivityProvider);
  return connectivityAsync.when(
    data: (isOnline) => isOnline,
    loading: () => true, // ローディング中はオンラインと仮定
    error: (_, __) => true, // エラー時もオンラインと仮定
  );
});
