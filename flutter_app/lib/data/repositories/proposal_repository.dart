import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../core/app_logger.dart';
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
      AppLogger.api('GET $uri');
      final response = await http.get(uri);
      AppLogger.api('GET /api/proposals -> ${response.statusCode}');

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
    } catch (e, stackTrace) {
      if (e is ApiException) rethrow;
      AppLogger.api('GET /api/proposals FAILED', error: e, stack: stackTrace);
      throw NetworkException('ネットワークエラー', details: e.toString());
    }
  }

  /// 日次提案を生成
  Future<List<ProposalModel>> generateProposals(String dateKey) async {
    try {
      AppLogger.api('POST /api/proposals dateKey=$dateKey');
      final response = await http.post(
        Uri.parse('$baseUrl/api/proposals'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'dateKey': dateKey}),
      );
      AppLogger.api('POST /api/proposals -> ${response.statusCode}');

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
    } catch (e, stackTrace) {
      if (e is ApiException) rethrow;
      AppLogger.api('POST /api/proposals FAILED', error: e, stack: stackTrace);
      throw NetworkException('ネットワークエラー', details: e.toString());
    }
  }

  /// 提案ステータス更新
  Future<void> updateProposalStatus(String id, String status) async {
    try {
      AppLogger.api('PATCH /api/proposals/$id status=$status');
      final response = await http.patch(
        Uri.parse('$baseUrl/api/proposals/$id'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'status': status}),
      );
      AppLogger.api('PATCH /api/proposals/$id -> ${response.statusCode}');

      if (response.statusCode != 200) {
        throw ApiException(
          '提案の更新に失敗しました',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e, stackTrace) {
      if (e is ApiException) rethrow;
      AppLogger.api('PATCH /api/proposals/$id FAILED',
          error: e, stack: stackTrace);
      throw NetworkException('ネットワークエラー', details: e.toString());
    }
  }
}
