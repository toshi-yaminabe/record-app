import 'dart:developer' as developer;
import 'dart:io';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';

/// カテゴリ別デバッグロガー
///
/// `flutter logs` / Logcat で `record-app` タグでフィルタ可能。
/// アプリ内ストレージにもログファイルを書き出す。
class AppLogger {
  static const _name = 'record-app';
  static File? _logFile;

  /// 起動時に呼び出し — ログファイルを初期化
  static Future<void> init({PackageInfo? packageInfo}) async {
    final dir = await getApplicationDocumentsDirectory();
    _logFile = File('${dir.path}/debug.log');
    final versionSuffix = packageInfo != null
        ? ' v${packageInfo.version}+${packageInfo.buildNumber}'
        : '';
    await _logFile!.writeAsString(
      '=== record-app$versionSuffix debug log: ${DateTime.now().toIso8601String()} ===\n',
    );
  }

  static void api(String message, {Object? error, StackTrace? stack}) =>
      _log('API', message, error: error, stack: stack);

  static void db(String message, {Object? error, StackTrace? stack}) =>
      _log('DB', message, error: error, stack: stack);

  static void recording(String message, {Object? error, StackTrace? stack}) =>
      _log('REC', message, error: error, stack: stack);

  static void queue(String message, {Object? error, StackTrace? stack}) =>
      _log('QUEUE', message, error: error, stack: stack);

  static void lifecycle(String message, {Object? error, StackTrace? stack}) =>
      _log('LIFE', message, error: error, stack: stack);

  static void _log(String tag, String message,
      {Object? error, StackTrace? stack}) {
    final timestamp =
        DateTime.now().toIso8601String().substring(11, 23); // HH:mm:ss.SSS
    final line = '$timestamp [$tag] $message';
    developer.log('[$tag] $message',
        name: _name, error: error, stackTrace: stack);
    _logFile?.writeAsStringSync(
      '$line${error != null ? '\n  ERROR: $error' : ''}${stack != null ? '\n  STACK: $stack' : ''}\n',
      mode: FileMode.append,
    );
  }

  /// ログファイルの内容を読み取り
  static Future<String> readLog() async {
    if (_logFile == null || !await _logFile!.exists()) {
      return '(ログファイルなし)';
    }
    return await _logFile!.readAsString();
  }

  /// ログファイルをクリア
  static Future<void> clearLog() async {
    if (_logFile != null) {
      await _logFile!.writeAsString(
        '=== record-app debug log cleared: ${DateTime.now().toIso8601String()} ===\n',
      );
    }
  }
}
