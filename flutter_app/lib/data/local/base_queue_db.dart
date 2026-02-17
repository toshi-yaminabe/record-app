import 'package:sqflite_sqlcipher/sqflite.dart';
import '../../core/app_logger.dart';

/// オフラインキュー共通基底クラス
///
/// queue_entries / pending_transcribes 両テーブルで共通の
/// retry / dead-letter パターンを集約する。
abstract class BaseQueueDB {
  /// サブクラスが操作するテーブル名
  String get tableName;

  /// ステータスカラム名（両テーブル共通 'status'）
  String get statusColumn => 'status';

  /// pending状態を表す値のリスト（サブクラスでオーバーライド可）
  List<String> get pendingStatuses => const ['pending'];

  /// dead letter状態を表す値
  String get deadLetterStatus => 'dead_letter';

  /// データベースインスタンスを取得（UnifiedQueueDatabase経由）
  Future<Database> get database;

  /// エントリを完了としてマーク（行を削除）
  Future<void> markCompleted(int id) async {
    try {
      final db = await database;
      await db.delete(tableName, where: 'id = ?', whereArgs: [id]);
      AppLogger.db('$tableName: completed id=$id');
    } on DatabaseException catch (e, stack) {
      AppLogger.db('$tableName: markCompleted failed id=$id',
          error: e, stack: stack);
    }
  }

  /// エントリを失敗としてマーク（リトライカウント増加）
  Future<void> markFailed(int id, int newRetryCount) async {
    try {
      final db = await database;
      await db.update(
        tableName,
        {'retry_count': newRetryCount, statusColumn: 'pending'},
        where: 'id = ?',
        whereArgs: [id],
      );
      AppLogger.db(
          '$tableName: failed id=$id retryCount=$newRetryCount');
    } on DatabaseException catch (e, stack) {
      AppLogger.db('$tableName: markFailed failed id=$id',
          error: e, stack: stack);
    }
  }

  /// エントリをdead letterに移動
  Future<void> markDeadLetter(int id) async {
    try {
      final db = await database;
      await db.update(
        tableName,
        {statusColumn: deadLetterStatus},
        where: 'id = ?',
        whereArgs: [id],
      );
      AppLogger.db('$tableName: dead_letter id=$id');
    } on DatabaseException catch (e, stack) {
      AppLogger.db('$tableName: markDeadLetter failed id=$id',
          error: e, stack: stack);
    }
  }

  /// dead letterエントリをpendingに戻す
  Future<void> resetDeadLetters() async {
    try {
      final db = await database;
      await db.update(
        tableName,
        {statusColumn: 'pending', 'retry_count': 0},
        where: '$statusColumn = ?',
        whereArgs: [deadLetterStatus],
      );
      AppLogger.db('$tableName: resetDeadLetters');
    } on DatabaseException catch (e, stack) {
      AppLogger.db('$tableName: resetDeadLetters failed',
          error: e, stack: stack);
    }
  }

  /// 未処理エントリ数を取得
  Future<int> pendingCount() async {
    try {
      final db = await database;
      final placeholders = pendingStatuses.map((_) => '?').join(', ');
      final result = await db.rawQuery(
        'SELECT COUNT(*) as count FROM $tableName '
        'WHERE $statusColumn IN ($placeholders)',
        pendingStatuses,
      );
      return Sqflite.firstIntValue(result) ?? 0;
    } on DatabaseException catch (e, stack) {
      AppLogger.db('$tableName: pendingCount failed',
          error: e, stack: stack);
      return 0;
    }
  }

  /// dead letterエントリ数を取得
  Future<int> deadLetterCount() async {
    try {
      final db = await database;
      final result = await db.rawQuery(
        'SELECT COUNT(*) as count FROM $tableName '
        'WHERE $statusColumn = ?',
        [deadLetterStatus],
      );
      return Sqflite.firstIntValue(result) ?? 0;
    } on DatabaseException catch (e, stack) {
      AppLogger.db('$tableName: deadLetterCount failed',
          error: e, stack: stack);
      return 0;
    }
  }

  /// 全エントリを削除
  Future<void> clear() async {
    try {
      final db = await database;
      await db.delete(tableName);
      AppLogger.db('$tableName: cleared');
    } on DatabaseException catch (e, stack) {
      AppLogger.db('$tableName: clear failed', error: e, stack: stack);
    }
  }
}
