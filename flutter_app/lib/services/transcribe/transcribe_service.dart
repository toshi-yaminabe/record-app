import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

/// 文字起こしサービス
class TranscribeService {
  final String baseUrl;

  TranscribeService({required this.baseUrl});

  /// 音声ファイルを送信して文字起こし
  ///
  /// [filePath] 音声ファイルのパス
  /// [deviceId] 端末ID
  /// [sessionId] セッションID
  /// [segmentNo] セグメント番号
  /// [startAt] 録音開始時刻
  /// [endAt] 録音終了時刻
  Future<TranscribeResult> transcribe({
    required String filePath,
    required String deviceId,
    required String sessionId,
    required int segmentNo,
    required DateTime startAt,
    required DateTime endAt,
  }) async {
    // H2: baseUrlが空の場合は即座にエラー
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

    final uri = Uri.parse('$baseUrl/api/transcribe');
    final request = http.MultipartRequest('POST', uri);

    // ファイルを追加
    request.files.add(await http.MultipartFile.fromPath(
      'audio',
      filePath,
      filename: 'audio.m4a',
    ));

    // メタデータを追加
    request.fields['deviceId'] = deviceId;
    request.fields['sessionId'] = sessionId;
    request.fields['segmentNo'] = segmentNo.toString();
    request.fields['startAt'] = startAt.toIso8601String();
    request.fields['endAt'] = endAt.toIso8601String();

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode != 200) {
      throw TranscribeException('文字起こし失敗: ${response.body}');
    }

    final json = jsonDecode(response.body);
    return TranscribeResult(
      transcriptId: json['transcriptId'] as String,
      text: json['text'] as String,
    );
  }

  /// 文字起こし履歴を取得
  Future<List<TranscriptData>> getTranscripts({
    String? deviceId,
    String? sessionId,
  }) async {
    final params = <String, String>{};
    if (deviceId != null) params['deviceId'] = deviceId;
    if (sessionId != null) params['sessionId'] = sessionId;

    final uri = Uri.parse('$baseUrl/api/transcribe').replace(queryParameters: params);
    final response = await http.get(uri);

    if (response.statusCode != 200) {
      throw TranscribeException('取得失敗: ${response.body}');
    }

    final json = jsonDecode(response.body);
    final transcripts = json['transcripts'] as List;
    return transcripts.map((t) => TranscriptData.fromJson(t)).toList();
  }
}

/// 文字起こし結果
class TranscribeResult {
  final String transcriptId;
  final String text;

  TranscribeResult({
    required this.transcriptId,
    required this.text,
  });
}

/// 文字起こしデータ
class TranscriptData {
  final String id;
  final String deviceId;
  final String sessionId;
  final int segmentNo;
  final DateTime startAt;
  final DateTime endAt;
  final String text;
  final DateTime createdAt;

  TranscriptData({
    required this.id,
    required this.deviceId,
    required this.sessionId,
    required this.segmentNo,
    required this.startAt,
    required this.endAt,
    required this.text,
    required this.createdAt,
  });

  factory TranscriptData.fromJson(Map<String, dynamic> json) {
    return TranscriptData(
      id: json['id'] as String,
      deviceId: json['deviceId'] as String,
      sessionId: json['sessionId'] as String,
      segmentNo: json['segmentNo'] as int,
      startAt: DateTime.parse(json['startAt'] as String),
      endAt: DateTime.parse(json['endAt'] as String),
      text: json['text'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

/// 文字起こし例外
class TranscribeException implements Exception {
  final String message;
  TranscribeException(this.message);

  @override
  String toString() => message;
}
