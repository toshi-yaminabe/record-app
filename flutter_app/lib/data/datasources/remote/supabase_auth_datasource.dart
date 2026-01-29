import 'package:supabase_flutter/supabase_flutter.dart';

/// Supabase認証データソース
class SupabaseAuthDatasource {
  final SupabaseClient _client;

  SupabaseAuthDatasource(this._client);

  User? get currentUser => _client.auth.currentUser;

  Stream<AuthState> get authStateChanges => _client.auth.onAuthStateChange;

  /// メールでサインアップ
  Future<AuthResponse> signUp({
    required String email,
    required String password,
  }) async {
    return await _client.auth.signUp(
      email: email,
      password: password,
    );
  }

  /// メールでサインイン
  Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) async {
    return await _client.auth.signInWithPassword(
      email: email,
      password: password,
    );
  }

  /// サインアウト
  Future<void> signOut() async {
    await _client.auth.signOut();
  }

  /// パスワードリセット
  Future<void> resetPassword(String email) async {
    await _client.auth.resetPasswordForEmail(email);
  }
}
