import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../../core/app_logger.dart';

/// 文字起こしリトライ専用ストア
///
/// 汎用キューとは分離し、TranscribeService.transcribe() を直接リトライする。
/// 音声ファイルのパスを保持するため、multipart再送が可能。
class PendingTranscribeStore {
  static Database? _database;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB();
    return _database!;
  }

  Future<Database> _initDB() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'pending_transcribes.db');
    AppLogger.db('initDB: creating pending_transcribes table at $path');

    return await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE pending_transcribes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT NOT NULL,
            device_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            segment_no INTEGER NOT NULL,
            start_at TEXT NOT NULL,
            end_at TEXT NOT NULL,
            retry_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            created_at TEXT NOT NULL
          )
        ''');
      },
    );
  }

  /// 文字起こし待ちエントリを追加
  Future<int> add({
    required String filePath,
    required String deviceId,
    required String sessionId,
    required int segmentNo,
    required DateTime startAt,
    required DateTime endAt,
  }) async {
    final db = await database;
    final id = await db.insert('pending_transcribes', {
      'file_path': filePath,
      'device_id': deviceId,
      'session_id': sessionId,
      'segment_no': segmentNo,
      'start_at': startAt.toIso8601String(),
      'end_at': endAt.toIso8601String(),
      'retry_count': 0,
      'status': 'pending',
      'created_at': DateTime.now().toUtc().toIso8601String(),
    });
    AppLogger.db('pending_transcribe: added id=$id filePath=$filePath');
    return id;
  }

  /// pending状態のエントリ一覧を取得
  Future<List<PendingTranscribeEntry>> listPending() async {
    final db = await database;
    final maps = await db.query(
      'pending_transcribes',
      where: 'status = ?',
      whereArgs: ['pending'],
      orderBy: 'created_at ASC',
    );
    return maps.map((m) => PendingTranscribeEntry.fromMap(m)).toList();
  }

  /// エントリを完了としてマーク（削除）
  Future<void> markCompleted(int id) async {
    final db = await database;
    await db.delete(
      'pending_transcribes',
      where: 'id = ?',
      whereArgs: [id],
    );
    AppLogger.db('pending_transcribe: completed id=$id');
  }

  /// エントリを失敗としてマーク（リトライカウント増加）
  Future<void> markFailed(int id, int newRetryCount) async {
    final db = await database;
    await db.update(
      'pending_transcribes',
      {'retry_count': newRetryCount, 'status': 'pending'},
      where: 'id = ?',
      whereArgs: [id],
    );
    AppLogger.db(
        'pending_transcribe: failed id=$id retryCount=$newRetryCount');
  }

  /// エントリをdead letterに移動
  Future<void> markDeadLetter(int id) async {
    final db = await database;
    await db.update(
      'pending_transcribes',
      {'status': 'dead_letter'},
      where: 'id = ?',
      whereArgs: [id],
    );
    AppLogger.db('pending_transcribe: dead_letter id=$id');
  }

  /// pending件数
  Future<int> pendingCount() async {
    final db = await database;
    final result = await db.rawQuery(
      'SELECT COUNT(*) as count FROM pending_transcribes WHERE status = ?',
      ['pending'],
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }

  /// dead letter件数
  Future<int> deadLetterCount() async {
    final db = await database;
    final result = await db.rawQuery(
      'SELECT COUNT(*) as count FROM pending_transcribes WHERE status = ?',
      ['dead_letter'],
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }

  /// dead letterをpendingに戻す
  Future<void> resetDeadLetters() async {
    final db = await database;
    await db.update(
      'pending_transcribes',
      {'status': 'pending', 'retry_count': 0},
      where: 'status = ?',
      whereArgs: ['dead_letter'],
    );
  }

  /// 全クリア
  Future<void> clear() async {
    final db = await database;
    await db.delete('pending_transcribes');
  }

  /// データベースを閉じる
  Future<void> close() async {
    final db = _database;
    if (db != null) {
      await db.close();
      _database = null;
    }
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
      retryCount: map['retry_count'] as int,
      status: map['status'] as String,
      createdAt: DateTime.parse(map['created_at'] as String),
    );
  }
}
