import 'dart:math';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../core/app_logger.dart';

/// SQLCipher暗号化キー管理
///
/// Android KeystoreバックドのFlutterSecureStorageで
/// SQLCipherパスフレーズを安全に保持する。
class SecureDbKeyManager {
  static const _keyName = 'unified_queue_db_key';
  static const _keyLength = 32;

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  /// 暗号化キーを取得（未生成なら自動生成して保存）
  static Future<String> getOrCreateKey() async {
    try {
      final existing = await _storage.read(key: _keyName);
      if (existing != null && existing.isNotEmpty) {
        AppLogger.db('SecureDbKeyManager: existing key found');
        return existing;
      }

      final newKey = _generateRandomKey();
      await _storage.write(key: _keyName, value: newKey);
      AppLogger.db('SecureDbKeyManager: new key generated and stored');
      return newKey;
    } catch (e, stack) {
      AppLogger.db('SecureDbKeyManager: key retrieval failed',
          error: e, stack: stack);
      rethrow;
    }
  }

  /// 32文字のランダムキーを生成
  static String _generateRandomKey() {
    const chars =
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    final random = Random.secure();
    return List.generate(
      _keyLength,
      (_) => chars[random.nextInt(chars.length)],
    ).join();
  }
}
