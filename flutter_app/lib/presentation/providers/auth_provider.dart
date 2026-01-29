import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/providers.dart';
import '../../data/datasources/remote/supabase_auth_datasource.dart';

/// 認証データソースプロバイダー
final authDatasourceProvider = Provider<SupabaseAuthDatasource>((ref) {
  final client = ref.watch(supabaseClientProvider);
  return SupabaseAuthDatasource(client);
});

/// 認証状態
enum AuthStatus { initial, authenticated, unauthenticated, loading, error }

/// アプリ認証状態クラス
class AppAuthState {
  final AuthStatus status;
  final User? user;
  final String? errorMessage;

  const AppAuthState({
    this.status = AuthStatus.initial,
    this.user,
    this.errorMessage,
  });

  AppAuthState copyWith({
    AuthStatus? status,
    User? user,
    String? errorMessage,
  }) {
    return AppAuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      errorMessage: errorMessage,
    );
  }
}

/// 認証Notifier
class AuthNotifier extends StateNotifier<AppAuthState> {
  final SupabaseAuthDatasource _authDatasource;

  AuthNotifier(this._authDatasource) : super(const AppAuthState()) {
    _init();
  }

  void _init() {
    final user = _authDatasource.currentUser;
    if (user != null) {
      state = AppAuthState(status: AuthStatus.authenticated, user: user);
    } else {
      state = const AppAuthState(status: AuthStatus.unauthenticated);
    }

    _authDatasource.authStateChanges.listen((event) {
      if (event.session != null) {
        state = AppAuthState(
          status: AuthStatus.authenticated,
          user: event.session!.user,
        );
      } else {
        state = const AppAuthState(status: AuthStatus.unauthenticated);
      }
    });
  }

  Future<void> signIn(String email, String password) async {
    state = state.copyWith(status: AuthStatus.loading);
    try {
      await _authDatasource.signIn(email: email, password: password);
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: e.toString(),
      );
    }
  }

  Future<void> signUp(String email, String password) async {
    state = state.copyWith(status: AuthStatus.loading);
    try {
      await _authDatasource.signUp(email: email, password: password);
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: e.toString(),
      );
    }
  }

  Future<void> signOut() async {
    await _authDatasource.signOut();
  }
}

/// 認証プロバイダー
final authNotifierProvider =
    StateNotifierProvider<AuthNotifier, AppAuthState>((ref) {
  final datasource = ref.watch(authDatasourceProvider);
  return AuthNotifier(datasource);
});
