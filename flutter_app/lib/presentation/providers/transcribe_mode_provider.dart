import 'dart:developer' as developer;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/app_logger.dart';
import '../../core/transcribe_mode.dart';

const _modePreferenceKey = 'transcribe_mode';

class TranscribeModeNotifier extends StateNotifier<TranscribeMode?> {
  SharedPreferences? _prefs;

  TranscribeModeNotifier() : super(null) {
    _initAndLoad();
  }

  Future<SharedPreferences> _getPrefs() async {
    return _prefs ??= await SharedPreferences.getInstance();
  }

  Future<void> _initAndLoad() async {
    try {
      final prefs = await _getPrefs();
      final raw = prefs.getString(_modePreferenceKey);
      if (raw == null) {
        state = null;
        return;
      }
      state = TranscribeMode.values.firstWhere(
        (mode) => mode.name == raw,
        orElse: () => TranscribeMode.server,
      );
    } catch (e) {
      developer.log('TranscribeMode load failed: $e', name: 'record-app');
      // SharedPreferences失敗時はnull（モード選択画面を表示）
      state = null;
    }
  }

  /// モードを設定する。SharedPreferences永続化に失敗しても
  /// メモリ上のstateは更新し、画面遷移を優先する。
  Future<void> setMode(TranscribeMode mode) async {
    // まずstateを更新して画面遷移を即座に発生させる
    state = mode;
    AppLogger.lifecycle('transcribe mode selected: ${mode.name}');

    // 永続化は非同期で試行（失敗しても画面遷移には影響しない）
    try {
      final prefs = await _getPrefs();
      await prefs.setString(_modePreferenceKey, mode.name);
    } catch (e) {
      AppLogger.lifecycle('WARNING: transcribe mode persistence failed: $e');
      // 次回起動時にモード選択画面が再度表示されるが、今回は続行可能
    }
  }

  Future<void> clearMode() async {
    state = null;
    try {
      final prefs = await _getPrefs();
      await prefs.remove(_modePreferenceKey);
    } catch (e) {
      AppLogger.lifecycle('WARNING: transcribe mode clear failed: $e');
    }
  }
}

final transcribeModeProvider =
    StateNotifierProvider<TranscribeModeNotifier, TranscribeMode?>((ref) {
  return TranscribeModeNotifier();
});
