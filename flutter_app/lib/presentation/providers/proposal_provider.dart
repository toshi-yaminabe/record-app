import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/errors.dart';
import '../../core/app_logger.dart';
import '../../data/models/proposal_model.dart';
import '../../data/repositories/proposal_repository.dart';
import 'recording_provider.dart' show authenticatedClientProvider;

/// 提案リポジトリプロバイダー
final proposalRepositoryProvider = Provider<ProposalRepository>((ref) {
  final client = ref.watch(authenticatedClientProvider);
  return ProposalRepository(client: client);
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
      AppLogger.api('fetchTodayProposals failed', error: e);
      state = state.copyWith(isLoading: false, error: _toUserMessage(e));
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
      AppLogger.api('generateTodayProposals failed', error: e);
      state = state.copyWith(isGenerating: false, error: _toUserMessage(e));
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
      AppLogger.api('confirmProposal failed', error: e);
      state = state.copyWith(error: _toUserMessage(e));
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
      AppLogger.api('rejectProposal failed', error: e);
      state = state.copyWith(error: _toUserMessage(e));
    }
  }

  String _toUserMessage(Object error) {
    if (error is ApiException) {
      final msg = error.message;
      if (msg.contains('文字起こし済みの録音がありません')) {
        return 'この日はまだ録音データがないため、日次提案を作成できません。\n'
            '先に録音を行い、文字起こし完了後に再度お試しください。';
      }
      if (error.statusCode == 401) {
        return 'ログイン状態を確認できませんでした。再ログイン後にお試しください。';
      }
      return msg;
    }

    if (error is NetworkException) {
      return '通信に失敗しました。ネットワーク接続を確認して再度お試しください。';
    }

    return '日次チェックインの処理でエラーが発生しました。時間をおいて再度お試しください。';
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
