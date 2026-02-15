import '../models/bunjin_model.dart';
import 'authenticated_client.dart';

/// 文人リポジトリ
class BunjinRepository {
  final AuthenticatedClient client;

  BunjinRepository({required this.client});

  /// 文人一覧取得
  Future<List<BunjinModel>> getBunjins() async {
    final data = await client.get(
      '/api/bunjins',
      context: '分人一覧取得',
    );

    final bunjins = data['bunjins'] as List;
    return bunjins
        .map((b) => BunjinModel.fromJson(b as Map<String, dynamic>))
        .toList();
  }

  /// 文人作成（userIdはJWTから自動取得）
  Future<BunjinModel> createBunjin({
    required String slug,
    required String displayName,
    String? description,
    required String color,
    String? icon,
  }) async {
    final data = await client.post('/api/bunjins', body: {
      'slug': slug,
      'displayName': displayName,
      'description': description,
      'color': color,
      'icon': icon,
    }, context: '分人作成');

    return BunjinModel.fromJson(data['bunjin'] as Map<String, dynamic>);
  }

  /// 文人更新
  Future<BunjinModel> updateBunjin({
    required String bunjinId,
    String? displayName,
    String? description,
    String? color,
    String? icon,
  }) async {
    final updates = <String, dynamic>{};
    if (displayName != null) updates['displayName'] = displayName;
    if (description != null) updates['description'] = description;
    if (color != null) updates['color'] = color;
    if (icon != null) updates['icon'] = icon;

    final data = await client.patch(
      '/api/bunjins/$bunjinId',
      body: updates,
      context: '分人更新',
    );

    return BunjinModel.fromJson(data['bunjin'] as Map<String, dynamic>);
  }

  /// 文人削除
  Future<void> deleteBunjin(String bunjinId) async {
    await client.delete(
      '/api/bunjins/$bunjinId',
      context: '分人削除',
    );
  }
}
