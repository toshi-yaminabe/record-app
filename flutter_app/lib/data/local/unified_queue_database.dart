import 'package:sqflite_sqlcipher/sqflite.dart';
import 'package:path/path.dart';
import '../../core/app_logger.dart';

/// 統合オフラインキューデータベース
///
/// queue_entries + pending_transcribes を1つのDBファイルで管理する。
/// シングルトンパターンで全体で1つのDB接続を共有する。
class UnifiedQueueDatabase {
  static Database? _database;
  static String? _password;

  UnifiedQueueDatabase._();

  /// 暗号化パスワードを設定（main()のSecureDbKeyManager経由で呼び出す）
  static void setPassword(String password) {
    _password = password;
  }

  /// データベースインスタンスを取得
  static Future<Database> get instance async {
    if (_database != null) return _database!;
    _database = await _initDB();
    return _database!;
  }

  /// データベースパスを取得（テスト・マイグレーション用）
  static Future<String> get dbPath async {
    final dbDir = await getDatabasesPath();
    return join(dbDir, 'unified_queue.db');
  }

  static Future<Database> _initDB() async {
    final path = await dbPath;
    AppLogger.db('UnifiedQueueDatabase: opening at $path');

    return await openDatabase(
      path,
      version: 2,
      password: _password,
      onCreate: (db, version) async {
        AppLogger.db('UnifiedQueueDatabase: creating tables (v$version)');

        // queue_entries テーブル（汎用APIキュー）
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

        // pending_transcribes テーブル（文字起こし専用キュー）
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

        // local_transcripts テーブル（ローカル文字起こし結果の一時保持）
        await _createLocalTranscriptsTable(db);
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        AppLogger.db(
          'UnifiedQueueDatabase: upgrading v$oldVersion -> v$newVersion',
        );
        if (oldVersion < 2) {
          await _createLocalTranscriptsTable(db);
        }
      },
    );
  }

  static Future<void> _createLocalTranscriptsTable(Database db) async {
    await db.execute('''
      CREATE TABLE local_transcripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        segment_no INTEGER NOT NULL,
        start_at TEXT NOT NULL,
        end_at TEXT NOT NULL,
        text TEXT NOT NULL,
        selected_mode TEXT NOT NULL,
        executed_mode TEXT NOT NULL,
        fallback_reason TEXT,
        local_engine_version TEXT,
        sync_status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      )
    ''');
    AppLogger.db('UnifiedQueueDatabase: local_transcripts table created');
  }

  /// データベースを閉じる（テスト用）
  static Future<void> close() async {
    final db = _database;
    if (db != null) {
      await db.close();
      _database = null;
    }
  }

  /// データベースをリセット（テスト用）
  static void reset() {
    _database = null;
    _password = null;
  }
}
