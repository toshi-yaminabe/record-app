import 'dart:io';
import 'package:sqflite_sqlcipher/sqflite.dart';
import 'package:path/path.dart';
import '../../core/app_logger.dart';
import 'unified_queue_database.dart';

/// 旧DB → 統合DB マイグレーションヘルパー
///
/// 起動時に1回だけ実行。旧DBファイルが存在する場合のみ移行し、
/// 成功後は旧DBを.bakにリネームして退避する。
class MigrationHelper {
  /// 旧DBから統合DBへの移行を実行（必要な場合のみ）
  static Future<void> migrateIfNeeded() async {
    final dbDir = await getDatabasesPath();
    final oldQueuePath = join(dbDir, 'offline_queue.db');
    final oldTranscribePath = join(dbDir, 'pending_transcribes.db');

    final oldQueueExists = File(oldQueuePath).existsSync();
    final oldTranscribeExists = File(oldTranscribePath).existsSync();

    if (!oldQueueExists && !oldTranscribeExists) {
      AppLogger.db('MigrationHelper: no old DBs found, skipping');
      return;
    }

    AppLogger.db(
      'MigrationHelper: old DBs found '
      '(queue=$oldQueueExists, transcribe=$oldTranscribeExists)',
    );

    final unifiedDb = await UnifiedQueueDatabase.instance;

    try {
      await unifiedDb.transaction((txn) async {
        if (oldQueueExists) {
          await _migrateQueueEntries(txn, oldQueuePath);
        }
        if (oldTranscribeExists) {
          await _migrateTranscribeEntries(txn, oldTranscribePath);
        }
      });

      // 移行成功: 旧DBを.bakにリネーム
      if (oldQueueExists) {
        await _backupOldDb(oldQueuePath);
      }
      if (oldTranscribeExists) {
        await _backupOldDb(oldTranscribePath);
      }

      AppLogger.db('MigrationHelper: migration completed successfully');
    } catch (e, stack) {
      // エラー時は旧DB温存 → 次回起動でリトライ
      AppLogger.db(
        'MigrationHelper: migration failed, old DBs preserved for retry',
        error: e,
        stack: stack,
      );
    }
  }

  /// queue_entries テーブルの移行
  static Future<void> _migrateQueueEntries(
    Transaction txn,
    String oldDbPath,
  ) async {
    final oldDb = await openDatabase(oldDbPath, readOnly: true);
    try {
      final rows = await oldDb.query('queue_entries');
      AppLogger.db(
          'MigrationHelper: migrating ${rows.length} queue_entries');

      for (final row in rows) {
        await txn.insert('queue_entries', {
          'endpoint': row['endpoint'],
          'method': row['method'],
          'payload': row['payload'],
          'created_at': row['created_at'],
          'retry_count': row['retry_count'],
          'status': row['status'],
        });
      }
    } finally {
      await oldDb.close();
    }
  }

  /// pending_transcribes テーブルの移行
  static Future<void> _migrateTranscribeEntries(
    Transaction txn,
    String oldDbPath,
  ) async {
    final oldDb = await openDatabase(oldDbPath, readOnly: true);
    try {
      final rows = await oldDb.query('pending_transcribes');
      AppLogger.db(
          'MigrationHelper: migrating ${rows.length} pending_transcribes');

      for (final row in rows) {
        await txn.insert('pending_transcribes', {
          'file_path': row['file_path'],
          'device_id': row['device_id'],
          'session_id': row['session_id'],
          'segment_no': row['segment_no'],
          'start_at': row['start_at'],
          'end_at': row['end_at'],
          'storage_object_path': row['storage_object_path'],
          'retry_count': row['retry_count'],
          'status': row['status'],
          'created_at': row['created_at'],
        });
      }
    } finally {
      await oldDb.close();
    }
  }

  /// 旧DBファイルを.bakにリネーム
  static Future<void> _backupOldDb(String dbPath) async {
    final bakPath = '$dbPath.bak';
    try {
      await File(dbPath).rename(bakPath);
      AppLogger.db('MigrationHelper: backed up $dbPath -> $bakPath');

      // 関連ファイル（-journal, -wal, -shm）も退避
      for (final suffix in ['-journal', '-wal', '-shm']) {
        final related = File('$dbPath$suffix');
        if (related.existsSync()) {
          await related.rename('$bakPath$suffix');
        }
      }
    } catch (e) {
      AppLogger.db('MigrationHelper: backup rename failed for $dbPath',
          error: e);
    }
  }

  /// 平文統合DB → 暗号化統合DB への移行
  ///
  /// 統合DB(unified_queue.db)がパスワードなしで開ける場合のみ実行。
  /// 暗号化済みの場合はスキップ。
  static Future<void> migrateToEncrypted(String password) async {
    final dbDir = await getDatabasesPath();
    final unifiedPath = join(dbDir, 'unified_queue.db');

    if (!File(unifiedPath).existsSync()) {
      AppLogger.db('MigrationHelper: no unified_queue.db, skipping encryption');
      return;
    }

    // 既に暗号化済みかチェック（パスワードなしで開けるか）
    try {
      final testDb = await openDatabase(unifiedPath, readOnly: true);
      // パスワードなしで開けた → 平文DB → 移行が必要
      final queueRows = await testDb.query('queue_entries');
      final transcribeRows = await testDb.query('pending_transcribes');
      await testDb.close();

      AppLogger.db(
        'MigrationHelper: encrypting DB '
        '(${queueRows.length} queue, ${transcribeRows.length} transcribe)',
      );

      // 暗号化された新DBを作成
      final encryptedPath = join(dbDir, 'unified_queue_encrypted.db');
      final encDb = await openDatabase(
        encryptedPath,
        version: 1,
        password: password,
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
          await db.execute('''
            CREATE TABLE pending_transcribes (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              file_path TEXT NOT NULL,
              device_id TEXT NOT NULL,
              session_id TEXT NOT NULL,
              segment_no INTEGER NOT NULL,
              start_at TEXT NOT NULL,
              end_at TEXT NOT NULL,
              storage_object_path TEXT,
              retry_count INTEGER DEFAULT 0,
              status TEXT DEFAULT 'pending',
              created_at TEXT NOT NULL
            )
          ''');
        },
      );

      // データ移行
      await encDb.transaction((txn) async {
        for (final row in queueRows) {
          await txn.insert('queue_entries', {
            'endpoint': row['endpoint'],
            'method': row['method'],
            'payload': row['payload'],
            'created_at': row['created_at'],
            'retry_count': row['retry_count'],
            'status': row['status'],
          });
        }
        for (final row in transcribeRows) {
          await txn.insert('pending_transcribes', {
            'file_path': row['file_path'],
            'device_id': row['device_id'],
            'session_id': row['session_id'],
            'segment_no': row['segment_no'],
            'start_at': row['start_at'],
            'end_at': row['end_at'],
            'storage_object_path': row['storage_object_path'],
            'retry_count': row['retry_count'],
            'status': row['status'],
            'created_at': row['created_at'],
          });
        }
      });
      await encDb.close();

      // 旧平文DBを退避し、暗号化DBをリネーム
      final bakPath = '$unifiedPath.unencrypted.bak';
      await File(unifiedPath).rename(bakPath);
      await File(encryptedPath).rename(unifiedPath);

      AppLogger.db('MigrationHelper: encryption migration completed');
    } on DatabaseException {
      // パスワードなしで開けない → 既に暗号化済み
      AppLogger.db('MigrationHelper: DB already encrypted, skipping');
    } catch (e, stack) {
      AppLogger.db(
        'MigrationHelper: encryption migration failed',
        error: e,
        stack: stack,
      );
    }
  }

  /// .bakファイルを削除（移行後の安定動作確認後に呼び出す）
  static Future<void> cleanupBackups() async {
    final dbDir = await getDatabasesPath();
    final dir = Directory(dbDir);

    if (!dir.existsSync()) return;

    final bakFiles = dir
        .listSync()
        .whereType<File>()
        .where((f) => f.path.endsWith('.bak'));

    for (final file in bakFiles) {
      try {
        await file.delete();
        AppLogger.db('MigrationHelper: deleted backup ${file.path}');
      } catch (e) {
        AppLogger.db('MigrationHelper: failed to delete ${file.path}',
            error: e);
      }
    }
  }
}
