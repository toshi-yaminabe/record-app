import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/app_logger.dart';
import '../../core/errors.dart';

/// JWT自動付与 + レスポンスエンベロープ展開 HTTPクライアント
///
/// バックエンドの統一レスポンス形式:
///   成功: { success: true, data: { ... } }
///   失敗: { success: false, error: "..." }
class AuthenticatedClient {
  final String baseUrl;

  AuthenticatedClient({required this.baseUrl});

  Map<String, String> _headers({bool json = true}) {
    final headers = <String, String>{};
    if (json) headers['Content-Type'] = 'application/json';

    try {
      final session = Supabase.instance.client.auth.currentSession;
      if (session != null) {
        headers['Authorization'] = 'Bearer ${session.accessToken}';
      }
    } catch (_) {
      // Supabase未初期化: ヘッダーなし（バックエンドDEV_AUTH_BYPASSで処理）
    }
    return headers;
  }

  /// エンベロープ展開: { success, data, error } → data
  Map<String, dynamic> _unwrap(http.Response response, String ctx) {
    if (response.statusCode == 401) {
      throw ApiException('認証が必要です', statusCode: 401);
    }

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final success = json['success'] as bool? ?? false;

    if (!success) {
      final error = json['error'] as String? ?? 'Unknown error';
      throw ApiException(error, statusCode: response.statusCode, details: response.body);
    }

    return json['data'] as Map<String, dynamic>? ?? {};
  }

  /// GET リクエスト
  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? queryParams,
    Duration timeout = const Duration(seconds: 15),
    String? context,
  }) async {
    final ctx = context ?? 'GET $path';
    try {
      var uri = Uri.parse('$baseUrl$path');
      if (queryParams != null && queryParams.isNotEmpty) {
        uri = uri.replace(queryParameters: queryParams);
      }
      AppLogger.api('GET $uri');

      final response = await http
          .get(uri, headers: _headers())
          .timeout(timeout);
      AppLogger.api('GET $path -> ${response.statusCode}');

      return _unwrap(response, ctx);
    } on TimeoutException {
      AppLogger.api('$ctx TIMEOUT');
      throw NetworkException('$ctxがタイムアウトしました');
    } on ApiException {
      rethrow;
    } catch (e, stack) {
      AppLogger.api('$ctx FAILED', error: e, stack: stack);
      throw NetworkException('Network error: $ctx', details: e.toString());
    }
  }

  /// POST リクエスト
  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    Duration timeout = const Duration(seconds: 30),
    String? context,
  }) async {
    final ctx = context ?? 'POST $path';
    try {
      final bodyJson = body != null ? jsonEncode(body) : null;
      AppLogger.api('POST $path body=$bodyJson');

      final response = await http
          .post(
            Uri.parse('$baseUrl$path'),
            headers: _headers(),
            body: bodyJson,
          )
          .timeout(timeout);
      AppLogger.api('POST $path -> ${response.statusCode}');

      return _unwrap(response, ctx);
    } on TimeoutException {
      AppLogger.api('$ctx TIMEOUT');
      throw NetworkException('$ctxがタイムアウトしました');
    } on ApiException {
      rethrow;
    } catch (e, stack) {
      AppLogger.api('$ctx FAILED', error: e, stack: stack);
      throw NetworkException('Network error: $ctx', details: e.toString());
    }
  }

  /// PATCH リクエスト
  Future<Map<String, dynamic>> patch(
    String path, {
    Map<String, dynamic>? body,
    Duration timeout = const Duration(seconds: 30),
    String? context,
  }) async {
    final ctx = context ?? 'PATCH $path';
    try {
      final bodyJson = body != null ? jsonEncode(body) : null;
      AppLogger.api('PATCH $path body=$bodyJson');

      final response = await http
          .patch(
            Uri.parse('$baseUrl$path'),
            headers: _headers(),
            body: bodyJson,
          )
          .timeout(timeout);
      AppLogger.api('PATCH $path -> ${response.statusCode}');

      return _unwrap(response, ctx);
    } on TimeoutException {
      AppLogger.api('$ctx TIMEOUT');
      throw NetworkException('$ctxがタイムアウトしました');
    } on ApiException {
      rethrow;
    } catch (e, stack) {
      AppLogger.api('$ctx FAILED', error: e, stack: stack);
      throw NetworkException('Network error: $ctx', details: e.toString());
    }
  }

  /// DELETE リクエスト
  Future<void> delete(
    String path, {
    Duration timeout = const Duration(seconds: 15),
    String? context,
  }) async {
    final ctx = context ?? 'DELETE $path';
    try {
      AppLogger.api('DELETE $path');

      final response = await http
          .delete(
            Uri.parse('$baseUrl$path'),
            headers: _headers(),
          )
          .timeout(timeout);
      AppLogger.api('DELETE $path -> ${response.statusCode}');

      // 200 or 204 are success
      if (response.statusCode != 200 && response.statusCode != 204) {
        _unwrap(response, ctx); // throws on error
      }
    } on TimeoutException {
      AppLogger.api('$ctx TIMEOUT');
      throw NetworkException('$ctxがタイムアウトしました');
    } on ApiException {
      rethrow;
    } catch (e, stack) {
      AppLogger.api('$ctx FAILED', error: e, stack: stack);
      throw NetworkException('Network error: $ctx', details: e.toString());
    }
  }
}
