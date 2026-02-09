import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../core/constants.dart';
import '../../core/errors.dart';
import '../models/proposal_model.dart';

/// 提案リポジトリ
class ProposalRepository {
  final String baseUrl;

  ProposalRepository({this.baseUrl = ApiConfig.baseUrl});

  /// 提案一覧取得
  Future<List<ProposalModel>> getProposals({
    String? dateKey,
    String? status,
  }) async {
    try {
      final queryParams = <String, String>{};
      if (dateKey != null) queryParams['dateKey'] = dateKey;
      if (status != null) queryParams['status'] = status;

      final uri = Uri.parse('$baseUrl/api/proposals')
          .replace(queryParameters: queryParams.isEmpty ? null : queryParams);
      final response = await http.get(uri);

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        final proposals = json['proposals'] as List;
        return proposals
            .map((p) => ProposalModel.fromJson(p as Map<String, dynamic>))
            .toList();
      } else {
        throw ApiException(
          '提案の取得に失敗しました',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw NetworkException('ネットワークエラー', details: e.toString());
    }
  }

  /// 日次提案を生成
  Future<List<ProposalModel>> generateProposals(String dateKey) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/proposals'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'dateKey': dateKey}),
      );

      if (response.statusCode == 201) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        final proposals = json['proposals'] as List;
        return proposals
            .map((p) => ProposalModel.fromJson(p as Map<String, dynamic>))
            .toList();
      } else {
        throw ApiException(
          '提案の生成に失敗しました',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw NetworkException('ネットワークエラー', details: e.toString());
    }
  }

  /// 提案ステータス更新
  Future<void> updateProposalStatus(String id, String status) async {
    try {
      final response = await http.patch(
        Uri.parse('$baseUrl/api/proposals/$id'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'status': status}),
      );

      if (response.statusCode != 200) {
        throw ApiException(
          '提案の更新に失敗しました',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw NetworkException('ネットワークエラー', details: e.toString());
    }
  }
}
