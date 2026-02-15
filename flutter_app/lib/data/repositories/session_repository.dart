import '../models/session_model.dart';
import 'authenticated_client.dart';

/// セッションリポジトリ
class SessionRepository {
  final AuthenticatedClient client;

  SessionRepository({required this.client});

  /// セッション作成（userIdはJWTから自動取得）
  Future<SessionModel> createSession({
    required String deviceId,
  }) async {
    final data = await client.post('/api/sessions', body: {
      'deviceId': deviceId,
      'startedAt': DateTime.now().toUtc().toIso8601String(),
    }, context: 'セッション作成');

    return SessionModel.fromJson(data['session'] as Map<String, dynamic>);
  }

  /// セッション取得
  Future<SessionModel> getSession(String sessionId) async {
    final data = await client.get(
      '/api/sessions/$sessionId',
      context: 'セッション取得',
    );

    return SessionModel.fromJson(data['session'] as Map<String, dynamic>);
  }

  /// セッション完了
  Future<SessionModel> completeSession(String sessionId) async {
    final data = await client.patch('/api/sessions/$sessionId', body: {
      'status': 'STOPPED',
      'endedAt': DateTime.now().toUtc().toIso8601String(),
    }, context: 'セッション完了');

    return SessionModel.fromJson(data['session'] as Map<String, dynamic>);
  }

  /// ユーザーのセッション一覧取得
  Future<List<SessionModel>> getUserSessions() async {
    final data = await client.get(
      '/api/sessions',
      context: 'セッション一覧取得',
    );

    final sessions = data['sessions'] as List;
    return sessions
        .map((s) => SessionModel.fromJson(s as Map<String, dynamic>))
        .toList();
  }
}
