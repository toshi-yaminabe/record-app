import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../../core/app_logger.dart';
import 'queue_entry.dart';

/// オフラインキューデータベース
class OfflineQueueDB {
  static Database? _database;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB();
    return _database!;
  }

  Future<Database> _initDB() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'offline_queue.db');
    AppLogger.db('initDB: creating queue_entries table at $path');

    return await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE queue_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            endpoint TEXT NOT NULL,
            method TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL,
            retry_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending'
          )
        ''');
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        AppLogger.db('Upgrading DB from v$oldVersion to v$newVersion');
        // Future migrations go here
      },
    );
  }

  /// エントリをキューに追加
  Future<int> enqueue(QueueEntry entry) async {
    try {
      final db = await database;
      final result = await db.insert('queue_entries', entry.toMap());
      AppLogger.db('enqueue: id=$result');
      return result;
    } on DatabaseException catch (e, stack) {
      AppLogger.db('enqueue failed', error: e, stack: stack);
      rethrow;
    }
  }

  /// 次の処理対象エントリを取得（FIFO）
  Future<QueueEntry?> dequeueNext() async {
    try {
      final db = await database;
      final List<Map<String, dynamic>> maps = await db.query(
        'queue_entries',
        where: 'status = ?',
        whereArgs: [QueueEntry.statusPending],
        orderBy: 'created_at ASC',
        limit: 1,
      );

      if (maps.isEmpty) return null;
      final entry = QueueEntry.fromMap(maps.first);
      AppLogger.db('dequeueNext: found entry#${entry.id}');
      return entry;
    } on DatabaseException catch (e, stack) {
      AppLogger.db('dequeueNext failed', error: e, stack: stack);
      return null;
    }
  }

  /// エントリを完了としてマーク（削除）
  Future<void> markCompleted(int id) async {
    try {
      final db = await database;
      await db.delete(
        'queue_entries',
        where: 'id = ?',
        whereArgs: [id],
      );
    } on DatabaseException catch (e, stack) {
      AppLogger.db('markCompleted failed for id=$id', error: e, stack: stack);
    }
  }

  /// エントリを失敗としてマーク（リトライカウント増加）
  Future<void> markFailed(int id, int newRetryCount) async {
    try {
      final db = await database;
      await db.update(
        'queue_entries',
        {'retry_count': newRetryCount, 'status': QueueEntry.statusPending},
        where: 'id = ?',
        whereArgs: [id],
      );
    } on DatabaseException catch (e, stack) {
      AppLogger.db('markFailed failed for id=$id', error: e, stack: stack);
    }
  }

  /// エントリをdead letterに移動
  Future<void> markDeadLetter(int id) async {
    try {
      final db = await database;
      await db.update(
        'queue_entries',
        {'status': QueueEntry.statusDeadLetter},
        where: 'id = ?',
        whereArgs: [id],
      );
    } on DatabaseException catch (e, stack) {
      AppLogger.db('markDeadLetter failed for id=$id',
          error: e, stack: stack);
    }
  }

  /// dead letterエントリをpendingに戻す
  Future<void> resetDeadLetters() async {
    try {
      final db = await database;
      await db.update(
        'queue_entries',
        {
          'status': QueueEntry.statusPending,
          'retry_count': 0,
        },
        where: 'status = ?',
        whereArgs: [QueueEntry.statusDeadLetter],
      );
    } on DatabaseException catch (e, stack) {
      AppLogger.db('resetDeadLetters failed', error: e, stack: stack);
    }
  }

  /// dead letterエントリ数を取得
  Future<int> deadLetterCount() async {
    try {
      final db = await database;
      final result = await db.rawQuery(
        'SELECT COUNT(*) as count FROM queue_entries WHERE status = ?',
        [QueueEntry.statusDeadLetter],
      );
      return Sqflite.firstIntValue(result) ?? 0;
    } on DatabaseException catch (e, stack) {
      AppLogger.db('deadLetterCount failed', error: e, stack: stack);
      return 0;
    }
  }

  /// 未処理エントリ数を取得
  Future<int> pendingCount() async {
    try {
      final db = await database;
      final result = await db.rawQuery(
        'SELECT COUNT(*) as count FROM queue_entries WHERE status = ?',
        [QueueEntry.statusPending],
      );
      return Sqflite.firstIntValue(result) ?? 0;
    } on DatabaseException catch (e, stack) {
      AppLogger.db('pendingCount failed', error: e, stack: stack);
      return 0;
    }
  }

  /// キューをクリア（全削除）
  Future<void> clear() async {
    try {
      final db = await database;
      await db.delete('queue_entries');
    } on DatabaseException catch (e, stack) {
      AppLogger.db('clear failed', error: e, stack: stack);
    }
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
