import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/app_logger.dart';
import '../../core/transcribe_mode.dart';

const _modePreferenceKey = 'transcribe_mode';

class TranscribeModeNotifier extends StateNotifier<TranscribeMode?> {
  TranscribeModeNotifier() : super(null) {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_modePreferenceKey);
    if (raw == null) {
      state = null;
      return;
    }

    state = TranscribeMode.values.firstWhere(
      (mode) => mode.name == raw,
      orElse: () => TranscribeMode.server,
    );
  }

  Future<void> setMode(TranscribeMode mode) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_modePreferenceKey, mode.name);
    AppLogger.lifecycle('transcribe mode selected: ${mode.name}');
    state = mode;
  }

  Future<void> clearMode() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_modePreferenceKey);
    state = null;
  }
}

final transcribeModeProvider =
    StateNotifierProvider<TranscribeModeNotifier, TranscribeMode?>((ref) {
  return TranscribeModeNotifier();
});
