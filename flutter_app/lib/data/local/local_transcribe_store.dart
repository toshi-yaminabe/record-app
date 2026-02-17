import 'package:sqflite_sqlcipher/sqflite.dart';
import '../../core/app_logger.dart';
import 'base_queue_db.dart';
import 'unified_queue_database.dart';

/// ローカル文字起こし結果一時保持ストア
///
/// BaseQueueDB を継承し、文字起こしテキスト+メタデータをSQLiteに一次保存する。
/// サーバー同期成功後に markCompleted() で行削除される。
class LocalTranscribeStore extends BaseQueueDB {
  @override
  String get tableName => 'local_transcripts';

  @override
  Future<Database> get database => UnifiedQueueDatabase.instance;

  /// 文字起こし結果をローカルに保存
  Future<int> add({
    required String sessionId,
    required int segmentNo,
    required DateTime startAt,
    required DateTime endAt,
    required String text,
    required String selectedMode,
    required String executedMode,
    String? fallbackReason,
    String? localEngineVersion,
  }) async {
    try {
      final db = await database;
      final id = await db.insert(tableName, {
        'session_id': sessionId,
        'segment_no': segmentNo,
        'start_at': startAt.toIso8601String(),
        'end_at': endAt.toIso8601String(),
        'text': text,
        'selected_mode': selectedMode,
        'executed_mode': executedMode,
        'fallback_reason': fallbackReason,
        'local_engine_version': localEngineVersion,
        'sync_status': 'pending',
        'retry_count': 0,
        'created_at': DateTime.now().toUtc().toIso8601String(),
      });
      AppLogger.db(
        'local_transcripts: added id=$id sessionId=$sessionId '
        'segmentNo=$segmentNo mode=$selectedMode→$executedMode',
      );
      return id;
    } on DatabaseException catch (e, stack) {
      AppLogger.db('local_transcripts: add failed', error: e, stack: stack);
      rethrow;
    }
  }

  /// 未同期エントリ一覧（古い順）
  Future<List<LocalTranscribeEntry>> listPending() async {
    try {
      final db = await database;
      final maps = await db.query(
        tableName,
        where: "sync_status = 'pending'",
        orderBy: 'created_at ASC',
      );
      return maps.map((m) => LocalTranscribeEntry.fromMap(m)).toList();
    } on DatabaseException catch (e, stack) {
      AppLogger.db('local_transcripts: listPending failed',
          error: e, stack: stack);
      return [];
    }
  }
}

/// ローカル文字起こしエントリ（不変DTO）
class LocalTranscribeEntry {
  final int id;
  final String sessionId;
  final int segmentNo;
  final DateTime startAt;
  final DateTime endAt;
  final String text;
  final String selectedMode;
  final String executedMode;
  final String? fallbackReason;
  final String? localEngineVersion;
  final int retryCount;
  final String syncStatus;
  final DateTime createdAt;

  const LocalTranscribeEntry({
    required this.id,
    required this.sessionId,
    required this.segmentNo,
    required this.startAt,
    required this.endAt,
    required this.text,
    required this.selectedMode,
    required this.executedMode,
    this.fallbackReason,
    this.localEngineVersion,
    required this.retryCount,
    required this.syncStatus,
    required this.createdAt,
  });

  factory LocalTranscribeEntry.fromMap(Map<String, dynamic> map) {
    return LocalTranscribeEntry(
      id: map['id'] as int,
      sessionId: map['session_id'] as String,
      segmentNo: map['segment_no'] as int,
      startAt: DateTime.parse(map['start_at'] as String),
      endAt: DateTime.parse(map['end_at'] as String),
      text: map['text'] as String,
      selectedMode: map['selected_mode'] as String,
      executedMode: map['executed_mode'] as String,
      fallbackReason: map['fallback_reason'] as String?,
      localEngineVersion: map['local_engine_version'] as String?,
      retryCount: map['retry_count'] as int,
      syncStatus: map['sync_status'] as String,
      createdAt: DateTime.parse(map['created_at'] as String),
    );
  }
}
