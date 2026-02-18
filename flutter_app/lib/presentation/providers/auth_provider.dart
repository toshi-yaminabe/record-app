import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/app_logger.dart';

/// 認証状態
class AuthState {
  final User? user;
  final bool isLoading;
  final String? error;

  const AuthState({
    this.user,
    this.isLoading = false,
    this.error,
  });

  bool get isAuthenticated => user != null;

  AuthState copyWith({
    User? user,
    bool? isLoading,
    String? error,
    bool clearUser = false,
    bool clearError = false,
  }) {
    return AuthState(
      user: clearUser ? null : (user ?? this.user),
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

/// 認証Notifier
class AuthNotifier extends StateNotifier<AuthState> {
  StreamSubscription<dynamic>? _authSubscription;

  AuthNotifier() : super(const AuthState(isLoading: true)) {
    _initialize();
  }

  void _initialize() {
    // Supabase未初期化チェック（Auth未設定時はクラッシュしない）
    final SupabaseClient supabase;
    try {
      supabase = Supabase.instance.client;
    } catch (_) {
      AppLogger.lifecycle('auth: Supabase not initialized, skipping auth');
      state = const AuthState();
      return;
    }

    // 現在のセッションをチェック
    final currentUser = supabase.auth.currentUser;
    if (currentUser != null) {
      AppLogger.lifecycle('auth: restored session for ${currentUser.email}');
      state = AuthState(user: currentUser);
    } else {
      state = const AuthState();
    }

    // 認証状態の変化を監視
    _authSubscription = supabase.auth.onAuthStateChange.listen((data) {
      final event = data.event;
      final session = data.session;

      AppLogger.lifecycle('auth: event=$event user=${session?.user.email}');

      switch (event) {
        case AuthChangeEvent.signedIn:
        case AuthChangeEvent.tokenRefreshed:
          state = AuthState(user: session?.user);
        case AuthChangeEvent.signedOut:
          state = const AuthState();
        case AuthChangeEvent.userUpdated:
          state = AuthState(user: session?.user);
        default:
          break;
      }
    });
  }

  /// メール+パスワードでサインアップ
  Future<void> signUp({
    required String email,
    required String password,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await Supabase.instance.client.auth.signUp(
        email: email,
        password: password,
      );

      if (response.user != null) {
        AppLogger.lifecycle('auth: signUp success email=$email');
        state = AuthState(user: response.user);
      } else {
        state = const AuthState(error: '確認メールを送信しました。メールを確認してください。');
      }
    } on AuthException catch (e) {
      AppLogger.lifecycle('auth: signUp failed', error: e);
      state = AuthState(error: _translateAuthError(e));
    } catch (e) {
      AppLogger.lifecycle('auth: signUp error', error: e);
      state = AuthState(error: 'サインアップに失敗しました: $e');
    }
  }

  /// メール+パスワードでサインイン
  Future<void> signIn({
    required String email,
    required String password,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await Supabase.instance.client.auth.signInWithPassword(
        email: email,
        password: password,
      );

      AppLogger.lifecycle('auth: signIn success email=$email');
      state = AuthState(user: response.user);
    } on AuthException catch (e) {
      AppLogger.lifecycle('auth: signIn failed', error: e);
      state = AuthState(error: _translateAuthError(e));
    } catch (e) {
      AppLogger.lifecycle('auth: signIn error', error: e);
      state = AuthState(error: 'ログインに失敗しました: $e');
    }
  }

  /// サインアウト
  Future<void> signOut() async {
    try {
      await Supabase.instance.client.auth.signOut();
      AppLogger.lifecycle('auth: signOut success');
      state = const AuthState();
    } catch (e) {
      AppLogger.lifecycle('auth: signOut error', error: e);
      state = state.copyWith(error: 'ログアウトに失敗しました: $e');
    }
  }

  /// エラーメッセージを翻訳
  String _translateAuthError(AuthException e) {
    final msg = e.message.toLowerCase();
    if (msg.contains('invalid login credentials')) {
      return 'メールアドレスまたはパスワードが正しくありません';
    }
    if (msg.contains('email not confirmed')) {
      return 'メールアドレスが確認されていません。確認メールをチェックしてください。';
    }
    if (msg.contains('user already registered')) {
      return 'このメールアドレスは既に登録されています';
    }
    if (msg.contains('password')) {
      return 'パスワードは6文字以上にしてください';
    }
    return e.message;
  }

  @override
  void dispose() {
    _authSubscription?.cancel();
    super.dispose();
  }
}

/// 認証プロバイダー
final authNotifierProvider =
    StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});

/// 現在のユーザーIDプロバイダー（便利getter）
final currentUserIdProvider = Provider<String?>((ref) {
  final authState = ref.watch(authNotifierProvider);
  return authState.user?.id;
});
