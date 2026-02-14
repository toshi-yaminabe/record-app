import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../core/app_logger.dart';
import '../../core/constants.dart';
import '../../core/errors.dart';
import '../models/bunjin_model.dart';

/// 文人リポジトリ
class BunjinRepository {
  final String baseUrl;

  BunjinRepository({this.baseUrl = ApiConfig.baseUrl});

  /// 文人一覧取得
  Future<List<BunjinModel>> getBunjins() async {
    try {
      AppLogger.api('GET /api/bunjins');
      final response = await http.get(
        Uri.parse('$baseUrl/api/bunjins'),
      ).timeout(const Duration(seconds: 15));
      AppLogger.api('GET /api/bunjins -> ${response.statusCode}');

      if (response.statusCode == 200) {
        // S1: エンベロープ展開 — バックエンドは { bunjins: [...] } で返す
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        final List<dynamic> bunjins = json['bunjins'] as List;
        return bunjins
            .map((b) => BunjinModel.fromJson(b as Map<String, dynamic>))
            .toList();
      } else {
        throw ApiException(
          'Failed to get bunjins',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } on TimeoutException {
      AppLogger.api('GET /api/bunjins TIMEOUT');
      throw NetworkException('分人一覧取得がタイムアウトしました');
    } catch (e, stackTrace) {
      if (e is ApiException) rethrow;
      AppLogger.api('GET /api/bunjins FAILED', error: e, stack: stackTrace);
      throw NetworkException('Network error during bunjins retrieval',
          details: e.toString());
    }
  }

  /// 文人作成
  Future<BunjinModel> createBunjin({
    required String userId,
    required String slug,
    required String displayName,
    String? description,
    required String color,
    String? icon,
  }) async {
    final bodyJson = jsonEncode({
      'userId': userId,
      'slug': slug,
      'displayName': displayName,
      'description': description,
      'color': color,
      'icon': icon,
    });

    try {
      AppLogger.api('POST /api/bunjins body=$bodyJson');
      final response = await http.post(
        Uri.parse('$baseUrl/api/bunjins'),
        headers: {'Content-Type': 'application/json'},
        body: bodyJson,
      ).timeout(const Duration(seconds: 30));
      AppLogger.api('POST /api/bunjins -> ${response.statusCode}');

      if (response.statusCode == 201) {
        // S1: エンベロープ展開 — バックエンドは { bunjin: {...} } で返す
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return BunjinModel.fromJson(json['bunjin'] as Map<String, dynamic>);
      } else {
        throw ApiException(
          'Failed to create bunjin',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } on TimeoutException {
      AppLogger.api('POST /api/bunjins TIMEOUT');
      throw NetworkException('分人作成がタイムアウトしました');
    } catch (e, stackTrace) {
      if (e is ApiException) rethrow;
      AppLogger.api('POST /api/bunjins FAILED', error: e, stack: stackTrace);
      throw NetworkException('Network error during bunjin creation',
          details: e.toString());
    }
  }

  /// 文人更新
  Future<BunjinModel> updateBunjin({
    required String bunjinId,
    String? displayName,
    String? description,
    String? color,
    String? icon,
  }) async {
    try {
      final updates = <String, dynamic>{};
      if (displayName != null) updates['displayName'] = displayName;
      if (description != null) updates['description'] = description;
      if (color != null) updates['color'] = color;
      if (icon != null) updates['icon'] = icon;

      final bodyJson = jsonEncode(updates);
      AppLogger.api('PATCH /api/bunjins/$bunjinId body=$bodyJson');

      final response = await http.patch(
        Uri.parse('$baseUrl/api/bunjins/$bunjinId'),
        headers: {'Content-Type': 'application/json'},
        body: bodyJson,
      ).timeout(const Duration(seconds: 30));
      AppLogger.api('PATCH /api/bunjins/$bunjinId -> ${response.statusCode}');

      if (response.statusCode == 200) {
        // S1: エンベロープ展開 — バックエンドは { bunjin: {...} } で返す
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return BunjinModel.fromJson(json['bunjin'] as Map<String, dynamic>);
      } else {
        throw ApiException(
          'Failed to update bunjin',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } on TimeoutException {
      AppLogger.api('PATCH /api/bunjins/$bunjinId TIMEOUT');
      throw NetworkException('分人更新がタイムアウトしました');
    } catch (e, stackTrace) {
      if (e is ApiException) rethrow;
      AppLogger.api('PATCH /api/bunjins/$bunjinId FAILED',
          error: e, stack: stackTrace);
      throw NetworkException('Network error during bunjin update',
          details: e.toString());
    }
  }

  /// 文人削除
  Future<void> deleteBunjin(String bunjinId) async {
    try {
      AppLogger.api('DELETE /api/bunjins/$bunjinId');
      final response = await http.delete(
        Uri.parse('$baseUrl/api/bunjins/$bunjinId'),
      ).timeout(const Duration(seconds: 15));
      AppLogger.api('DELETE /api/bunjins/$bunjinId -> ${response.statusCode}');

      if (response.statusCode != 204 && response.statusCode != 200) {
        throw ApiException(
          'Failed to delete bunjin',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } on TimeoutException {
      AppLogger.api('DELETE /api/bunjins/$bunjinId TIMEOUT');
      throw NetworkException('分人削除がタイムアウトしました');
    } catch (e, stackTrace) {
      if (e is ApiException) rethrow;
      AppLogger.api('DELETE /api/bunjins/$bunjinId FAILED',
          error: e, stack: stackTrace);
      throw NetworkException('Network error during bunjin deletion',
          details: e.toString());
    }
  }
}
