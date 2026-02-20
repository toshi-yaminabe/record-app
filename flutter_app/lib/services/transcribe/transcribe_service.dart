import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/app_logger.dart';
import '../../core/transcribe_mode.dart';

/// 文字起こしサービス
///
/// フロー: multipart POST /api/transcribe
/// 音声ファイルと各種パラメータを送信してSTTを実行
///
/// ServerEngine が委任先として使用する。
class TranscribeService {
  final String baseUrl;

  TranscribeService({required this.baseUrl});

  /// 音声ファイルを送信して文字起こし
  /// multipart POST /api/transcribe を使用
  Future<TranscribeResult> transcribe({
    required String filePath,
    required String deviceId,
    required String sessionId,
    required int segmentNo,
    required DateTime startAt,
    required DateTime endAt,
    TranscribeMode mode = TranscribeMode.server,
  }) async {
    if (baseUrl.isEmpty) {
      throw TranscribeException(
        'API_BASE_URLが設定されていません。'
        '--dart-define-from-file=env/prod.json でビルドしてください。',
      );
    }

    final file = File(filePath);
    if (!await file.exists()) {
      throw TranscribeException('ファイルが存在しません: $filePath');
    }

    if (mode == TranscribeMode.local) {
      AppLogger.api(
        'transcribe: local mode requested, fallback to server flow (preparation phase)',
      );
    }

    return _transcribeViaMultipart(
      file: file,
      deviceId: deviceId,
      sessionId: sessionId,
      segmentNo: segmentNo,
      startAt: startAt,
      endAt: endAt,
    );
  }

  /// 旧フロー: multipart POST /api/transcribe
  Future<TranscribeResult> _transcribeViaMultipart({
    required File file,
    required String deviceId,
    required String sessionId,
    required int segmentNo,
    required DateTime startAt,
    required DateTime endAt,
  }) async {
    AppLogger.api(
        'transcribe: legacy multipart flow sessionId=$sessionId segmentNo=$segmentNo');

    final uri = Uri.parse('$baseUrl/api/transcribe');
    final request = http.MultipartRequest('POST', uri);

    // Authヘッダー（あれば付与）
    try {
      final session = Supabase.instance.client.auth.currentSession;
      if (session != null) {
        request.headers['Authorization'] = 'Bearer ${session.accessToken}';
      }
    } catch (_) {
      // Supabase未初期化: ヘッダーなし
    }

    request.fields['deviceId'] = deviceId;
    request.fields['sessionId'] = sessionId;
    request.fields['segmentNo'] = segmentNo.toString();
    request.fields['startAt'] = startAt.toUtc().toIso8601String();
    request.fields['endAt'] = endAt.toUtc().toIso8601String();

    request.files.add(await http.MultipartFile.fromPath(
      'audio',
      file.path,
      contentType: MediaType('audio', 'mp4'),
    ));

    final streamedResponse = await request.send().timeout(
      const Duration(seconds: 90),
    );
    final response = await http.Response.fromStream(streamedResponse);

    AppLogger.api('POST /api/transcribe -> ${response.statusCode}');

    if (response.statusCode != 200) {
      throw TranscribeException(
        '文字起こし失敗 (${response.statusCode}): ${response.body}',
        statusCode: response.statusCode,
      );
    }

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final success = json['success'] as bool? ?? false;
    if (!success) {
      throw TranscribeException(
          '文字起こし失敗: ${json['error'] ?? 'Unknown error'}');
    }

    final data = json['data'] as Map<String, dynamic>;
    final segment = data['segment'] as Map<String, dynamic>;
    return TranscribeResult(
      segmentId: segment['id'] as String,
      text: segment['text'] as String? ?? '',
      sessionId: segment['sessionId'] as String?,
    );
  }

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

/// 文字起こし結果
class TranscribeResult {
  final String segmentId;
  final String text;
  final String? sessionId;

  TranscribeResult({
    required this.segmentId,
    required this.text,
    this.sessionId,
  });
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
