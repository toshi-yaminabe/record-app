import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/app_logger.dart';
import '../../core/constants.dart';
import '../../data/models/session_model.dart';
import '../../data/repositories/session_repository.dart';
import 'recording_provider.dart' show deviceIdProvider;

/// セッションリポジトリプロバイダー
final sessionRepositoryProvider = Provider<SessionRepository>((ref) {
  return SessionRepository();
});

/// セッション状態
class SessionState {
  final SessionModel? currentSession;
  final bool isLoading;
  final String? error;

  const SessionState({
    this.currentSession,
    this.isLoading = false,
    this.error,
  });

  SessionState copyWith({
    SessionModel? currentSession,
    bool? isLoading,
    String? error,
  }) {
    return SessionState(
      currentSession: currentSession ?? this.currentSession,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// セッション状態Notifier
class SessionNotifier extends StateNotifier<SessionState> {
  final SessionRepository _repository;
  final String _deviceId;

  SessionNotifier(
    this._repository,
    this._deviceId,
  ) : super(const SessionState());

  /// セッション作成
  Future<SessionModel?> createSession() async {
    // H2: deviceIdが未解決の場合はセッション作成をブロック
    if (_deviceId == 'loading' || _deviceId == 'error') {
      AppLogger.lifecycle(
          'createSession BLOCKED: deviceId=$_deviceId');
      state = SessionState(
          error: 'デバイスIDの取得中です。しばらく待ってから再試行してください。',
          isLoading: false);
      return null;
    }

    state = state.copyWith(isLoading: true);
    try {
      final session = await _repository.createSession(
        userId: AppConstants.mockUserId,
        deviceId: _deviceId,
      );
      state = SessionState(currentSession: session, isLoading: false);
      return session;
    } catch (e) {
      state = SessionState(error: e.toString(), isLoading: false);
      return null;
    }
  }

  /// セッション完了
  Future<void> completeSession() async {
    final sessionId = state.currentSession?.id;
    if (sessionId == null) return;

    state = state.copyWith(isLoading: true);
    try {
      final updatedSession = await _repository.completeSession(sessionId);
      state = SessionState(currentSession: updatedSession, isLoading: false);
    } catch (e) {
      state = state.copyWith(error: e.toString(), isLoading: false);
    }
  }

  /// セッションをクリア
  void clearSession() {
    state = const SessionState();
  }
}

/// セッションプロバイダー
final sessionNotifierProvider =
    StateNotifierProvider<SessionNotifier, SessionState>((ref) {
  final repository = ref.watch(sessionRepositoryProvider);
  final deviceIdAsync = ref.watch(deviceIdProvider);

  final deviceId = deviceIdAsync.when(
    data: (id) => id,
    loading: () => 'loading',
    error: (_, __) => 'error',
  );

  return SessionNotifier(repository, deviceId);
});
