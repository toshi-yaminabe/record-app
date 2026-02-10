import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../core/app_logger.dart';
import '../../core/constants.dart';
import '../../core/errors.dart';
import '../models/session_model.dart';

/// セッションリポジトリ
class SessionRepository {
  final String baseUrl;

  SessionRepository({this.baseUrl = ApiConfig.baseUrl});

  /// セッション作成
  Future<SessionModel> createSession({
    required String userId,
    required String deviceId,
  }) async {
    final bodyJson = jsonEncode({
      'userId': userId,
      'deviceId': deviceId,
      'startedAt': DateTime.now().toUtc().toIso8601String(),
    });

    try {
      AppLogger.api('POST /api/sessions body=$bodyJson');
      final response = await http.post(
        Uri.parse('$baseUrl/api/sessions'),
        headers: {'Content-Type': 'application/json'},
        body: bodyJson,
      );
      AppLogger.api(
          'POST /api/sessions -> ${response.statusCode} body=${response.body}');

      if (response.statusCode == 201) {
        // S1: エンベロープ展開 — バックエンドは { session: {...} } で返す
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return SessionModel.fromJson(json['session'] as Map<String, dynamic>);
      } else {
        throw ApiException(
          'Failed to create session',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e, stackTrace) {
      if (e is ApiException) rethrow;
      AppLogger.api('POST /api/sessions FAILED', error: e, stack: stackTrace);
      throw NetworkException('Network error during session creation',
          details: e.toString());
    }
  }

  /// セッション取得
  Future<SessionModel> getSession(String sessionId) async {
    try {
      AppLogger.api('GET /api/sessions/$sessionId');
      final response = await http.get(
        Uri.parse('$baseUrl/api/sessions/$sessionId'),
      );
      AppLogger.api(
          'GET /api/sessions/$sessionId -> ${response.statusCode}');

      if (response.statusCode == 200) {
        // S1: エンベロープ展開
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return SessionModel.fromJson(json['session'] as Map<String, dynamic>);
      } else {
        throw ApiException(
          'Failed to get session',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e, stackTrace) {
      if (e is ApiException) rethrow;
      AppLogger.api('GET /api/sessions/$sessionId FAILED',
          error: e, stack: stackTrace);
      throw NetworkException('Network error during session retrieval',
          details: e.toString());
    }
  }

  /// セッション完了
  Future<SessionModel> completeSession(String sessionId) async {
    try {
      // C2: バックエンドは 'STOPPED' を使用する
      final bodyJson = jsonEncode({
        'status': 'STOPPED',
        'endedAt': DateTime.now().toUtc().toIso8601String(),
      });
      AppLogger.api('PATCH /api/sessions/$sessionId body=$bodyJson');

      final response = await http.patch(
        Uri.parse('$baseUrl/api/sessions/$sessionId'),
        headers: {'Content-Type': 'application/json'},
        body: bodyJson,
      );
      AppLogger.api(
          'PATCH /api/sessions/$sessionId -> ${response.statusCode}');

      if (response.statusCode == 200) {
        // S1: エンベロープ展開
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return SessionModel.fromJson(json['session'] as Map<String, dynamic>);
      } else {
        throw ApiException(
          'Failed to complete session',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e, stackTrace) {
      if (e is ApiException) rethrow;
      AppLogger.api('PATCH /api/sessions/$sessionId FAILED',
          error: e, stack: stackTrace);
      throw NetworkException('Network error during session completion',
          details: e.toString());
    }
  }

  /// ユーザーのセッション一覧取得
  Future<List<SessionModel>> getUserSessions(String userId) async {
    try {
      AppLogger.api('GET /api/sessions?userId=$userId');
      final response = await http.get(
        Uri.parse('$baseUrl/api/sessions?userId=$userId'),
      );
      AppLogger.api(
          'GET /api/sessions?userId=$userId -> ${response.statusCode}');

      if (response.statusCode == 200) {
        // S1: エンベロープ展開 — バックエンドは { sessions: [...] } で返す
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        final List<dynamic> sessions = json['sessions'] as List;
        return sessions
            .map((s) => SessionModel.fromJson(s as Map<String, dynamic>))
            .toList();
      } else {
        throw ApiException(
          'Failed to get sessions',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e, stackTrace) {
      if (e is ApiException) rethrow;
      AppLogger.api('GET /api/sessions FAILED', error: e, stack: stackTrace);
      throw NetworkException('Network error during sessions retrieval',
          details: e.toString());
    }
  }
}
