import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/models/proposal_model.dart';
import '../../providers/proposal_provider.dart';

/// 日次チェックインページ
class DailyCheckinPage extends ConsumerStatefulWidget {
  const DailyCheckinPage({super.key});

  @override
  ConsumerState<DailyCheckinPage> createState() => _DailyCheckinPageState();
}

class _DailyCheckinPageState extends ConsumerState<DailyCheckinPage> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() async {
      // 今日の提案を取得し、空なら自動生成
      await ref.read(proposalNotifierProvider.notifier).fetchTodayProposals();
      final state = ref.read(proposalNotifierProvider);
      if (state.proposals.isEmpty && !state.isGenerating) {
        ref.read(proposalNotifierProvider.notifier).generateTodayProposals();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(proposalNotifierProvider);

    // REJECTED以外のみ表示
    final visibleProposals = state.proposals
        .where((p) => p.status != 'REJECTED')
        .toList();

    return RefreshIndicator(
      onRefresh: () async {
        await ref.read(proposalNotifierProvider.notifier).fetchTodayProposals();
      },
      child: CustomScrollView(
        slivers: [
          // 日付ヘッダー
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _formatDateHeader(),
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '今日の提案を確認・承認できます',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                ],
              ),
            ),
          ),

          // エラー表示
          if (state.error != null)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: Card(
                  color: Theme.of(context).colorScheme.errorContainer,
                  child: Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              Icons.error_outline,
                              size: 18,
                              color: Theme.of(context)
                                  .colorScheme
                                  .onErrorContainer,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '日次チェックインでエラーが発生しました',
                              style: TextStyle(
                                color: Theme.of(context)
                                    .colorScheme
                                    .onErrorContainer,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          state.error!,
                          style: TextStyle(
                            color: Theme.of(context)
                                .colorScheme
                                .onErrorContainer,
                          ),
                        ),
                        if (_isNoRecordingError(state.error!)) ...[
                          const SizedBox(height: 10),
                          Text(
                            '次の手順で解消できます',
                            style: TextStyle(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onErrorContainer,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '1. 録音タブで録音を開始\n'
                            '2. 文字起こしが完了するまで待つ\n'
                            '3. この画面で「再生成」を実行',
                            style: TextStyle(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onErrorContainer,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),

          if (state.error != null && _isNoRecordingError(state.error!))
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Card(
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                  child: const Padding(
                    padding: EdgeInsets.all(12.0),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.tips_and_updates_outlined, size: 20),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            '日次チェックインは「文字起こし済みの録音」をもとに提案を作成します。\n'
                            '録音直後は処理待ちの場合があるため、少し時間をおいて再試行してください。',
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

          // 再生成ボタン（提案が存在する場合のみ表示）
          if (state.proposals.isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: FilledButton.icon(
                  onPressed: state.isGenerating
                      ? null
                      : () {
                          ref
                              .read(proposalNotifierProvider.notifier)
                              .generateTodayProposals();
                        },
                  icon: state.isGenerating
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.auto_awesome),
                  label: const Text('再生成'),
                ),
              ),
            ),

          const SliverToBoxAdapter(child: SizedBox(height: 16)),

          // ローディング
          if (state.isLoading || state.isGenerating)
            const SliverToBoxAdapter(
              child: Center(
                child: Padding(
                  padding: EdgeInsets.all(32.0),
                  child: CircularProgressIndicator(),
                ),
              ),
            ),

          // 提案が空
          if (!state.isLoading && !state.isGenerating && state.proposals.isEmpty)
            SliverToBoxAdapter(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32.0),
                  child: Column(
                    children: [
                      Icon(
                        Icons.lightbulb_outline,
                        size: 48,
                        color: Theme.of(context).colorScheme.outline,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'まだ提案がありません',
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                              color: Theme.of(context).colorScheme.outline,
                            ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          // 提案カードリスト（REJECTED除外済み）
          if (!state.isLoading && !state.isGenerating && visibleProposals.isNotEmpty)
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final proposal = visibleProposals[index];
                  return _ProposalCard(proposal: proposal);
                },
                childCount: visibleProposals.length,
              ),
            ),

          const SliverToBoxAdapter(child: SizedBox(height: 32)),
        ],
      ),
    );
  }

  String _formatDateHeader() {
    final now = DateTime.now();
    const weekdays = ['月', '火', '水', '木', '金', '土', '日'];
    final weekday = weekdays[now.weekday - 1];
    return '${now.year}/${now.month}/${now.day}（$weekday）';
  }

  bool _isNoRecordingError(String message) {
    return message.contains('録音データがない') ||
        message.contains('文字起こし済みの録音がありません');
  }
}

class _ProposalCard extends ConsumerWidget {
  final ProposalModel proposal;

  const _ProposalCard({required this.proposal});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isPending = proposal.status == 'PENDING';
    final isConfirmed = proposal.status == 'CONFIRMED';

    // 確定済み: 縮小・チェックマーク表示
    if (isConfirmed) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 2.0),
        child: Card(
          elevation: 0,
          color: Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.4),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
            child: Row(
              children: [
                Icon(
                  Icons.check_circle,
                  size: 18,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    proposal.title,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onPrimaryContainer,
                        ),
                  ),
                ),
                _TypeBadge(type: proposal.type),
              ],
            ),
          ),
        ),
      );
    }

    // 未決定: ExpansionTileでボディを折りたたみ
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
      child: Card(
        elevation: isPending ? 2 : 0,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ヘッダー行（タイプバッジ + タイトル + ステータス）
            if (proposal.body != null && proposal.body!.isNotEmpty)
              ExpansionTile(
                leading: _TypeBadge(type: proposal.type),
                title: Text(
                  proposal.title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      proposal.body!,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                    ),
                  ),
                ],
              )
            else
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: Row(
                  children: [
                    _TypeBadge(type: proposal.type),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        proposal.title,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                  ],
                ),
              ),

            // アクションボタン
            if (isPending)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    OutlinedButton(
                      onPressed: () {
                        ref
                            .read(proposalNotifierProvider.notifier)
                            .rejectProposal(proposal.id);
                      },
                      child: const Text('却下'),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: () {
                        ref
                            .read(proposalNotifierProvider.notifier)
                            .confirmProposal(proposal.id);
                      },
                      child: const Text('承認'),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _TypeBadge extends StatelessWidget {
  final String type;

  const _TypeBadge({required this.type});

  @override
  Widget build(BuildContext context) {
    final (label, icon, color) = switch (type) {
      'TASK' => ('タスク', Icons.task_alt, Colors.blue),
      'SUMMARY' => ('まとめ', Icons.summarize, Colors.green),
      'REFLECTION' => ('振り返り', Icons.psychology, Colors.orange),
      'GOAL' => ('目標', Icons.flag, Colors.purple),
      _ => (type, Icons.label, Colors.grey),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
