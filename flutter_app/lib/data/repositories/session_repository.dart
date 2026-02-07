import 'dart:convert';
import 'package:http/http.dart' as http;
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
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/sessions'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'userId': userId,
          'deviceId': deviceId,
          'startedAt': DateTime.now().toUtc().toIso8601String(),
        }),
      );

      if (response.statusCode == 201) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return SessionModel.fromJson(json);
      } else {
        throw ApiException(
          'Failed to create session',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw NetworkException('Network error during session creation', details: e.toString());
    }
  }

  /// セッション取得
  Future<SessionModel> getSession(String sessionId) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/sessions/$sessionId'),
      );

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return SessionModel.fromJson(json);
      } else {
        throw ApiException(
          'Failed to get session',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw NetworkException('Network error during session retrieval', details: e.toString());
    }
  }

  /// セッション完了
  Future<SessionModel> completeSession(String sessionId) async {
    try {
      final response = await http.patch(
        Uri.parse('$baseUrl/api/sessions/$sessionId'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'status': 'COMPLETED',
          'endedAt': DateTime.now().toUtc().toIso8601String(),
        }),
      );

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return SessionModel.fromJson(json);
      } else {
        throw ApiException(
          'Failed to complete session',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw NetworkException('Network error during session completion', details: e.toString());
    }
  }

  /// ユーザーのセッション一覧取得
  Future<List<SessionModel>> getUserSessions(String userId) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/sessions?userId=$userId'),
      );

      if (response.statusCode == 200) {
        final List<dynamic> jsonList = jsonDecode(response.body) as List;
        return jsonList.map((json) => SessionModel.fromJson(json as Map<String, dynamic>)).toList();
      } else {
        throw ApiException(
          'Failed to get sessions',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw NetworkException('Network error during sessions retrieval', details: e.toString());
    }
  }
}
