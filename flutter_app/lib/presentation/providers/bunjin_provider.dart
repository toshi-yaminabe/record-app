import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/bunjin_model.dart';
import '../../data/repositories/bunjin_repository.dart';
import 'recording_provider.dart' show authenticatedClientProvider;

/// 文人リポジトリプロバイダー
final bunjinRepositoryProvider = Provider<BunjinRepository>((ref) {
  final client = ref.watch(authenticatedClientProvider);
  return BunjinRepository(client: client);
});

/// 文人状態
class BunjinState {
  final List<BunjinModel> bunjins;
  final bool isLoading;
  final String? error;

  const BunjinState({
    this.bunjins = const [],
    this.isLoading = false,
    this.error,
  });

  BunjinState copyWith({
    List<BunjinModel>? bunjins,
    bool? isLoading,
    String? error,
  }) {
    return BunjinState(
      bunjins: bunjins ?? this.bunjins,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// 文人状態Notifier
class BunjinNotifier extends StateNotifier<BunjinState> {
  final BunjinRepository _repository;

  BunjinNotifier(this._repository) : super(const BunjinState());

  /// 文人一覧取得
  Future<void> fetchBunjins() async {
    state = state.copyWith(isLoading: true);
    try {
      final bunjins = await _repository.getBunjins();
      state = BunjinState(bunjins: bunjins, isLoading: false);
    } catch (e) {
      state = BunjinState(error: e.toString(), isLoading: false);
    }
  }

  /// 文人作成
  Future<void> createBunjin({
    required String slug,
    required String displayName,
    String? description,
    required String color,
    String? icon,
  }) async {
    try {
      final newBunjin = await _repository.createBunjin(
        slug: slug,
        displayName: displayName,
        description: description,
        color: color,
        icon: icon,
      );
      state = state.copyWith(bunjins: [...state.bunjins, newBunjin]);
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  /// デフォルト文人を取得
  BunjinModel? getDefaultBunjin() {
    return state.bunjins.where((b) => b.isDefault).firstOrNull;
  }
}

/// 文人プロバイダー
final bunjinNotifierProvider =
    StateNotifierProvider<BunjinNotifier, BunjinState>((ref) {
  final repository = ref.watch(bunjinRepositoryProvider);
  return BunjinNotifier(repository);
});
