import 'dart:io';
import 'package:path/path.dart' as p;
import 'package:supabase_flutter/supabase_flutter.dart';

/// アップロードサービス
class UploadService {
  final SupabaseClient _client;

  static const String _bucketName = 'audio-recordings';

  UploadService(this._client);

  /// 音声ファイルをアップロード
  ///
  /// [filePath] ローカルファイルパス
  /// [sessionId] セッションID
  /// [segmentId] セグメントID
  ///
  /// Returns: Storage上のパス
  Future<UploadResult> uploadAudio({
    required String filePath,
    required String sessionId,
    required String segmentId,
  }) async {
    final file = File(filePath);
    if (!await file.exists()) {
      throw UploadException('ファイルが存在しません: $filePath');
    }

    final userId = _client.auth.currentUser?.id;
    if (userId == null) {
      throw UploadException('ユーザーが認証されていません');
    }

    // Storage パス: user_id/session_id/segment_id.m4a
    final storagePath = '$userId/$sessionId/$segmentId.m4a';

    try {
      final bytes = await file.readAsBytes();

      await _client.storage.from(_bucketName).uploadBinary(
        storagePath,
        bytes,
        fileOptions: const FileOptions(
          contentType: 'audio/mp4',
          upsert: false,
        ),
      );

      return UploadResult(
        storagePath: storagePath,
        localPath: filePath,
        segmentId: segmentId,
      );
    } on StorageException catch (e) {
      throw UploadException('アップロード失敗: ${e.message}');
    }
  }

  /// アップロード済みファイルのURLを取得
  Future<String> getSignedUrl(String storagePath, {int expiresIn = 3600}) async {
    final response = await _client.storage
        .from(_bucketName)
        .createSignedUrl(storagePath, expiresIn);
    return response;
  }

  /// ファイルを削除
  Future<void> deleteFile(String storagePath) async {
    await _client.storage.from(_bucketName).remove([storagePath]);
  }
}

/// アップロード結果
class UploadResult {
  final String storagePath;
  final String localPath;
  final String segmentId;

  UploadResult({
    required this.storagePath,
    required this.localPath,
    required this.segmentId,
  });
}

/// アップロード例外
class UploadException implements Exception {
  final String message;
  UploadException(this.message);

  @override
  String toString() => message;
}
