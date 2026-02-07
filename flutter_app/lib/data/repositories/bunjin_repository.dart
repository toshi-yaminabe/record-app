import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../core/constants.dart';
import '../../core/errors.dart';
import '../models/bunjin_model.dart';

/// 文人リポジトリ
class BunjinRepository {
  final String baseUrl;

  BunjinRepository({this.baseUrl = ApiConfig.baseUrl});

  /// 文人一覧取得
  Future<List<BunjinModel>> getBunjins(String userId) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/bunjins?userId=$userId'),
      );

      if (response.statusCode == 200) {
        final List<dynamic> jsonList = jsonDecode(response.body) as List;
        return jsonList.map((json) => BunjinModel.fromJson(json as Map<String, dynamic>)).toList();
      } else {
        throw ApiException(
          'Failed to get bunjins',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw NetworkException('Network error during bunjins retrieval', details: e.toString());
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
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/bunjins'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'userId': userId,
          'slug': slug,
          'displayName': displayName,
          'description': description,
          'color': color,
          'icon': icon,
        }),
      );

      if (response.statusCode == 201) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return BunjinModel.fromJson(json);
      } else {
        throw ApiException(
          'Failed to create bunjin',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw NetworkException('Network error during bunjin creation', details: e.toString());
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

      final response = await http.patch(
        Uri.parse('$baseUrl/api/bunjins/$bunjinId'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(updates),
      );

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return BunjinModel.fromJson(json);
      } else {
        throw ApiException(
          'Failed to update bunjin',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw NetworkException('Network error during bunjin update', details: e.toString());
    }
  }

  /// 文人削除
  Future<void> deleteBunjin(String bunjinId) async {
    try {
      final response = await http.delete(
        Uri.parse('$baseUrl/api/bunjins/$bunjinId'),
      );

      if (response.statusCode != 204 && response.statusCode != 200) {
        throw ApiException(
          'Failed to delete bunjin',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw NetworkException('Network error during bunjin deletion', details: e.toString());
    }
  }
}
