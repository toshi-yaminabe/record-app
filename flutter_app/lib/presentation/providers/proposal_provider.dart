import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/proposal_model.dart';
import '../../data/repositories/proposal_repository.dart';

/// 提案リポジトリプロバイダー
final proposalRepositoryProvider = Provider<ProposalRepository>((ref) {
  return ProposalRepository();
});

/// 提案状態
class ProposalState {
  final List<ProposalModel> proposals;
  final bool isLoading;
  final bool isGenerating;
  final String? error;

  const ProposalState({
    this.proposals = const [],
    this.isLoading = false,
    this.isGenerating = false,
    this.error,
  });

  ProposalState copyWith({
    List<ProposalModel>? proposals,
    bool? isLoading,
    bool? isGenerating,
    String? error,
    bool clearError = false,
  }) {
    return ProposalState(
      proposals: proposals ?? this.proposals,
      isLoading: isLoading ?? this.isLoading,
      isGenerating: isGenerating ?? this.isGenerating,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

/// 提案Notifier
class ProposalNotifier extends StateNotifier<ProposalState> {
  final ProposalRepository _repository;

  ProposalNotifier(this._repository) : super(const ProposalState());

  /// 今日の提案を取得
  Future<void> fetchTodayProposals() async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final dateKey = _todayDateKey();
      final proposals = await _repository.getProposals(dateKey: dateKey);
      state = state.copyWith(proposals: proposals, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  /// 今日の提案を生成
  Future<void> generateTodayProposals() async {
    state = state.copyWith(isGenerating: true, clearError: true);

    try {
      final dateKey = _todayDateKey();
      final proposals = await _repository.generateProposals(dateKey);
      state = state.copyWith(proposals: proposals, isGenerating: false);
    } catch (e) {
      state = state.copyWith(isGenerating: false, error: e.toString());
    }
  }

  /// 提案を確認
  Future<void> confirmProposal(String id) async {
    try {
      await _repository.updateProposalStatus(id, 'CONFIRMED');
      final updated = state.proposals.map((p) {
        if (p.id == id) {
          return p.copyWith(status: 'CONFIRMED');
        }
        return p;
      }).toList();
      state = state.copyWith(proposals: updated);
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  /// 提案を却下
  Future<void> rejectProposal(String id) async {
    try {
      await _repository.updateProposalStatus(id, 'REJECTED');
      final updated = state.proposals.map((p) {
        if (p.id == id) {
          return p.copyWith(status: 'REJECTED');
        }
        return p;
      }).toList();
      state = state.copyWith(proposals: updated);
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  String _todayDateKey() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }
}

/// 提案プロバイダー
final proposalNotifierProvider =
    StateNotifierProvider<ProposalNotifier, ProposalState>((ref) {
  final repository = ref.watch(proposalRepositoryProvider);
  return ProposalNotifier(repository);
});
