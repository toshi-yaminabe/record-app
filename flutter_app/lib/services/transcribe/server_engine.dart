import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/app_logger.dart';
import '../../core/transcribe_mode.dart';
import 'transcribe_engine.dart';
import 'transcribe_request_context.dart';

/// サーバーSTTエンジン
///
/// multipart POST /api/transcribe で音声ファイルをサーバーに送信する。
/// multipart POST /api/transcribe で音声ファイルをサーバーに送信し、
/// Gemini STTで文字起こしを行う。
class ServerEngine implements TranscribeEngine {
  final String baseUrl;

  ServerEngine({required this.baseUrl});

  @override
  Future<TranscribeEngineResult> transcribe(
    TranscribeRequestContext context,
  ) async {
    final file = File(context.filePath);
    if (!await file.exists()) {
      throw ServerEngineException('ファイルが存在しません: ${context.filePath}');
    }

    AppLogger.api(
      'ServerEngine: multipart flow sessionId=${context.sessionId} '
      'segmentNo=${context.segmentNo}',
    );

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

    request.fields['deviceId'] = context.deviceId;
    request.fields['sessionId'] = context.sessionId;
    request.fields['segmentNo'] = context.segmentNo.toString();
    request.fields['startAt'] = context.startAt.toUtc().toIso8601String();
    request.fields['endAt'] = context.endAt.toUtc().toIso8601String();

    request.files.add(await http.MultipartFile.fromPath(
      'audio',
      file.path,
      contentType: MediaType('audio', 'mp4'),
    ));

    final streamedResponse = await request.send().timeout(
      const Duration(seconds: 90),
    );
    final response = await http.Response.fromStream(streamedResponse);

    AppLogger.api('ServerEngine: POST /api/transcribe -> ${response.statusCode}');

    if (response.statusCode != 200) {
      throw ServerEngineException(
        '文字起こし失敗 (${response.statusCode}): ${response.body}',
        statusCode: response.statusCode,
      );
    }

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final success = json['success'] as bool? ?? false;
    if (!success) {
      throw ServerEngineException(
        '文字起こし失敗: ${json['error'] ?? 'Unknown error'}',
      );
    }

    final data = json['data'] as Map<String, dynamic>;
    final segment = data['segment'] as Map<String, dynamic>;
    final text = segment['text'] as String? ?? '';

    return TranscribeEngineResult(
      text: text,
      selectedMode: TranscribeMode.server,
      executedMode: TranscribeMode.server,
      segmentId: segment['id'] as String?,
    );
  }
}

/// サーバーエンジン例外
class ServerEngineException implements Exception {
  final String message;
  final int? statusCode;

  ServerEngineException(this.message, {this.statusCode});

  @override
  String toString() => statusCode != null
      ? '$message (HTTP $statusCode)'
      : message;
}
