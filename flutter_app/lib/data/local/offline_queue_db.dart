import 'package:sqflite_sqlcipher/sqflite.dart';
import '../../core/app_logger.dart';
import 'base_queue_db.dart';
import 'queue_entry.dart';
import 'unified_queue_database.dart';

/// オフラインキューデータベース
///
/// 統合DB内の queue_entries テーブルを操作する。
class OfflineQueueDB extends BaseQueueDB {
  @override
  String get tableName => 'queue_entries';

  @override
  Future<Database> get database => UnifiedQueueDatabase.instance;

  /// エントリをキューに追加
  Future<int> enqueue(QueueEntry entry) async {
    try {
      final db = await database;
      final result = await db.insert(tableName, entry.toMap());
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
        tableName,
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

  /// データベースを閉じる
  Future<void> close() async {
    await UnifiedQueueDatabase.close();
  }
}
