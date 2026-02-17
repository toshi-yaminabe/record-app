import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/app_logger.dart';

/// 文字起こしサービス — セグメント取得専用
///
/// 文字起こし実行は ServerEngine (server_engine.dart) に移行済み。
/// このクラスはセグメント一覧取得のみ提供する。
class TranscribeService {
  final String baseUrl;

  TranscribeService({required this.baseUrl});

  /// セグメント一覧を取得
  Future<List<SegmentData>> getSegments({
    String? sessionId,
  }) async {
    final session = Supabase.instance.client.auth.currentSession;
    final headers = <String, String>{};
    if (session != null) {
      headers['Authorization'] = 'Bearer ${session.accessToken}';
    }

    final params = <String, String>{};
    if (sessionId != null) params['sessionId'] = sessionId;

    final uri =
        Uri.parse('$baseUrl/api/segments').replace(queryParameters: params);
    AppLogger.api('GET $uri');
    final response = await http
        .get(uri, headers: headers)
        .timeout(const Duration(seconds: 15));
    AppLogger.api('GET /api/segments -> ${response.statusCode}');

    if (response.statusCode != 200) {
      throw TranscribeException('セグメント取得失敗: ${response.body}');
    }

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final data = json['data'] as Map<String, dynamic>? ?? {};
    final segments = data['segments'] as List? ?? [];
    return segments.map((s) => SegmentData.fromJson(s)).toList();
  }
}

/// セグメントデータ
class SegmentData {
  final String id;
  final String sessionId;
  final int segmentNo;
  final DateTime startAt;
  final DateTime endAt;
  final String? text;
  final String sttStatus;
  final DateTime createdAt;

  SegmentData({
    required this.id,
    required this.sessionId,
    required this.segmentNo,
    required this.startAt,
    required this.endAt,
    this.text,
    required this.sttStatus,
    required this.createdAt,
  });

  factory SegmentData.fromJson(Map<String, dynamic> json) {
    return SegmentData(
      id: json['id'] as String,
      sessionId: json['sessionId'] as String,
      segmentNo: json['segmentNo'] as int,
      startAt: DateTime.parse(json['startAt'] as String),
      endAt: DateTime.parse(json['endAt'] as String),
      text: json['text'] as String?,
      sttStatus: json['sttStatus'] as String? ?? 'PENDING',
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

/// 文字起こし例外
class TranscribeException implements Exception {
  final String message;
  final int? statusCode;

  TranscribeException(this.message, {this.statusCode});

  @override
  String toString() => statusCode != null
      ? '$message (HTTP $statusCode)'
      : message;
}
