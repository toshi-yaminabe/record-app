import '../models/proposal_model.dart';
import 'authenticated_client.dart';

/// 提案リポジトリ
class ProposalRepository {
  final AuthenticatedClient client;

  ProposalRepository({required this.client});

  /// 提案一覧取得
  Future<List<ProposalModel>> getProposals({
    String? dateKey,
    String? status,
  }) async {
    final queryParams = <String, String>{};
    if (dateKey != null) queryParams['dateKey'] = dateKey;
    if (status != null) queryParams['status'] = status;

    final data = await client.get(
      '/api/proposals',
      queryParams: queryParams.isEmpty ? null : queryParams,
      context: '提案一覧取得',
    );

    final proposals = data['proposals'] as List;
    return proposals
        .map((p) => ProposalModel.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  /// 日次提案を生成
  Future<List<ProposalModel>> generateProposals(String dateKey) async {
    final data = await client.post(
      '/api/proposals',
      body: {'dateKey': dateKey},
      context: '提案生成',
    );

    final proposals = data['proposals'] as List;
    return proposals
        .map((p) => ProposalModel.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  /// 提案ステータス更新
  Future<void> updateProposalStatus(String id, String status) async {
    await client.patch(
      '/api/proposals/$id',
      body: {'status': status},
      context: '提案更新',
    );
  }
}
