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
    );
  }

  /// エントリをキューに追加
  Future<int> enqueue(QueueEntry entry) async {
    final db = await database;
    final result = await db.insert('queue_entries', entry.toMap());
    AppLogger.db('enqueue: id=$result');
    return result;
  }

  /// 次の処理対象エントリを取得（FIFO）
  Future<QueueEntry?> dequeueNext() async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      'queue_entries',
      where: 'status = ?',
      whereArgs: ['pending'],
      orderBy: 'created_at ASC',
      limit: 1,
    );

    if (maps.isEmpty) return null;
    final entry = QueueEntry.fromMap(maps.first);
    AppLogger.db('dequeueNext: found entry#${entry.id}');
    return entry;
  }

  /// エントリを完了としてマーク（削除）
  Future<void> markCompleted(int id) async {
    final db = await database;
    await db.delete(
      'queue_entries',
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  /// エントリを失敗としてマーク（リトライカウント増加）
  Future<void> markFailed(int id, int newRetryCount) async {
    final db = await database;
    await db.update(
      'queue_entries',
      {'retry_count': newRetryCount, 'status': 'pending'},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  /// エントリをdead letterに移動
  Future<void> markDeadLetter(int id) async {
    final db = await database;
    await db.update(
      'queue_entries',
      {'status': 'dead_letter'},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  /// dead letterエントリをpendingに戻す
  Future<void> resetDeadLetters() async {
    final db = await database;
    await db.update(
      'queue_entries',
      {'status': 'pending', 'retry_count': 0},
      where: 'status = ?',
      whereArgs: ['dead_letter'],
    );
  }

  /// dead letterエントリ数を取得
  Future<int> deadLetterCount() async {
    final db = await database;
    final result = await db.rawQuery(
      'SELECT COUNT(*) as count FROM queue_entries WHERE status = ?',
      ['dead_letter'],
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }

  /// 未処理エントリ数を取得
  Future<int> pendingCount() async {
    final db = await database;
    final result = await db.rawQuery(
      'SELECT COUNT(*) as count FROM queue_entries WHERE status = ?',
      ['pending'],
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }

  /// キューをクリア（全削除）
  Future<void> clear() async {
    final db = await database;
    await db.delete('queue_entries');
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
