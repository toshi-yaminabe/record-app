import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/app_logger.dart';

/// 文字起こしサービス
///
/// 新フロー: Storage直接アップロード + Edge Function process-audio
/// 1. POST /api/segments でPENDINGセグメント作成
/// 2. Supabase Storageに音声ファイルアップロード
/// 3. Edge Function process-audio を invoke
class TranscribeService {
  final String baseUrl;

  TranscribeService({required this.baseUrl});

  /// Supabase Authが利用可能かチェック
  bool _isSupabaseReady() {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      return user != null;
    } catch (_) {
      return false;
    }
  }

  /// 音声ファイルを送信して文字起こし
  /// Auth有効時: Storage + Edge Function（新フロー）
  /// Auth無効時: multipart POST（旧フロー、フォールバック）
  Future<TranscribeResult> transcribe({
    required String filePath,
    required String deviceId,
    required String sessionId,
    required int segmentNo,
    required DateTime startAt,
    required DateTime endAt,
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

    if (_isSupabaseReady()) {
      return _transcribeViaStorage(
        file: file,
        sessionId: sessionId,
        segmentNo: segmentNo,
        startAt: startAt,
        endAt: endAt,
      );
    } else {
      return _transcribeViaMultipart(
        file: file,
        deviceId: deviceId,
        sessionId: sessionId,
        segmentNo: segmentNo,
        startAt: startAt,
        endAt: endAt,
      );
    }
  }

  /// 新フロー: Storage直接アップロード + Edge Function
  Future<TranscribeResult> _transcribeViaStorage({
    required File file,
    required String sessionId,
    required int segmentNo,
    required DateTime startAt,
    required DateTime endAt,
  }) async {
    final supabase = Supabase.instance.client;
    final userId = supabase.auth.currentUser!.id;

    AppLogger.api(
        'transcribe: new flow sessionId=$sessionId segmentNo=$segmentNo');

    // 1. PENDINGセグメント作成
    final storagePath = '$userId/$sessionId/$segmentNo.m4a';
    final segmentId = await _createPendingSegment(
      sessionId: sessionId,
      segmentNo: segmentNo,
      startAt: startAt,
      endAt: endAt,
      storagePath: storagePath,
    );

    // 2. Supabase Storageにアップロード
    AppLogger.api('storage: uploading $storagePath size=${file.lengthSync()}');
    final fileBytes = await file.readAsBytes();
    await supabase.storage
        .from('audio-segments')
        .uploadBinary(
          storagePath,
          fileBytes,
          fileOptions: const FileOptions(
            contentType: 'audio/mp4',
            upsert: true,
          ),
        );
    AppLogger.api('storage: upload complete $storagePath');

    // 3. Edge Function process-audio を invoke
    AppLogger.api('edge-function: invoking process-audio segmentId=$segmentId');
    final efResponse = await supabase.functions.invoke(
      'process-audio',
      body: {
        'segmentId': segmentId,
        'storageObjectPath': storagePath,
      },
    );

    if (efResponse.status != 200) {
      final errorBody = efResponse.data is String
          ? efResponse.data as String
          : jsonEncode(efResponse.data);
      throw TranscribeException(
          'Edge Function失敗 (${efResponse.status}): $errorBody');
    }

    final result = efResponse.data as Map<String, dynamic>;
    final text = result['text'] as String? ?? '';
    AppLogger.api('edge-function: success text=${text.length}chars');

    return TranscribeResult(
      segmentId: segmentId,
      text: text,
    );
  }

  /// 旧フロー: multipart POST /api/transcribe（Auth無し時のフォールバック）
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

  /// PENDINGセグメントをAPIで作成
  Future<String> _createPendingSegment({
    required String sessionId,
    required int segmentNo,
    required DateTime startAt,
    required DateTime endAt,
    required String storagePath,
  }) async {
    final session = Supabase.instance.client.auth.currentSession;
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    if (session != null) {
      headers['Authorization'] = 'Bearer ${session.accessToken}';
    }

    final response = await http.post(
      Uri.parse('$baseUrl/api/segments'),
      headers: headers,
      body: jsonEncode({
        'sessionId': sessionId,
        'segmentNo': segmentNo,
        'startAt': startAt.toIso8601String(),
        'endAt': endAt.toIso8601String(),
        'storageObjectPath': storagePath,
      }),
    ).timeout(const Duration(seconds: 30));

    if (response.statusCode != 200) {
      throw TranscribeException('セグメント作成失敗: ${response.body}');
    }

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final success = json['success'] as bool? ?? false;
    if (!success) {
      throw TranscribeException(
          'セグメント作成失敗: ${json['error'] ?? 'Unknown error'}');
    }

    final data = json['data'] as Map<String, dynamic>;
    final segment = data['segment'] as Map<String, dynamic>;
    return segment['id'] as String;
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
