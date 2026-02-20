import 'package:sqflite_sqlcipher/sqflite.dart';
import '../../core/app_logger.dart';
import '../../data/local/base_queue_db.dart';
import '../../data/local/unified_queue_database.dart';

/// 文字起こしリトライ専用ストア
///
/// 状態遷移: pending(ローカル) → processed(STT済)
class PendingTranscribeStore extends BaseQueueDB {
  @override
  String get tableName => 'pending_transcribes';

  @override
  List<String> get pendingStatuses => const ['pending'];

  @override
  Future<Database> get database => UnifiedQueueDatabase.instance;

  /// 文字起こし待ちエントリを追加
  Future<int> add({
    required String filePath,
    required String deviceId,
    required String sessionId,
    required int segmentNo,
    required DateTime startAt,
    required DateTime endAt,
    String? storageObjectPath,
  }) async {
    try {
      final db = await database;
      final id = await db.insert(tableName, {
        'file_path': filePath,
        'device_id': deviceId,
        'session_id': sessionId,
        'segment_no': segmentNo,
        'start_at': startAt.toIso8601String(),
        'end_at': endAt.toIso8601String(),
        'storage_object_path': storageObjectPath,
        'retry_count': 0,
        'status': 'pending',
        'created_at': DateTime.now().toUtc().toIso8601String(),
      });
      AppLogger.db('pending_transcribe: added id=$id filePath=$filePath');
      return id;
    } on DatabaseException catch (e, stack) {
      AppLogger.db('pending_transcribe: add failed', error: e, stack: stack);
      rethrow;
    }
  }

  /// pending状態のエントリ一覧を取得
  Future<List<PendingTranscribeEntry>> listPending() async {
    try {
      final db = await database;
      final maps = await db.query(
        tableName,
        where: "status = 'pending'",
        orderBy: 'created_at ASC',
      );
      return maps.map((m) => PendingTranscribeEntry.fromMap(m)).toList();
    } on DatabaseException catch (e, stack) {
      AppLogger.db('pending_transcribe: listPending failed',
          error: e, stack: stack);
      return [];
    }
  }

  /// データベースを閉じる
  Future<void> close() async {
    await UnifiedQueueDatabase.close();
  }
}

/// 文字起こし待ちエントリ
class PendingTranscribeEntry {
  final int id;
  final String filePath;
  final String deviceId;
  final String sessionId;
  final int segmentNo;
  final DateTime startAt;
  final DateTime endAt;
  final String? storageObjectPath;
  final int retryCount;
  final String status;
  final DateTime createdAt;

  const PendingTranscribeEntry({
    required this.id,
    required this.filePath,
    required this.deviceId,
    required this.sessionId,
    required this.segmentNo,
    required this.startAt,
    required this.endAt,
    this.storageObjectPath,
    required this.retryCount,
    required this.status,
    required this.createdAt,
  });

  factory PendingTranscribeEntry.fromMap(Map<String, dynamic> map) {
    return PendingTranscribeEntry(
      id: map['id'] as int,
      filePath: map['file_path'] as String,
      deviceId: map['device_id'] as String,
      sessionId: map['session_id'] as String,
      segmentNo: map['segment_no'] as int,
      startAt: DateTime.parse(map['start_at'] as String),
      endAt: DateTime.parse(map['end_at'] as String),
      storageObjectPath: map['storage_object_path'] as String?,
      retryCount: map['retry_count'] as int,
      status: map['status'] as String,
      createdAt: DateTime.parse(map['created_at'] as String),
    );
  }
}
