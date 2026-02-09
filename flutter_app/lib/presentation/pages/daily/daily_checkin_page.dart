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
    // 初回読み込み
    Future.microtask(() {
      ref.read(proposalNotifierProvider.notifier).fetchTodayProposals();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(proposalNotifierProvider);

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
                    child: Text(
                      state.error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onErrorContainer,
                      ),
                    ),
                  ),
                ),
              ),
            ),

          // 生成ボタン
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
                label: Text(
                  state.proposals.isEmpty ? '提案を生成' : '提案を再生成',
                ),
              ),
            ),
          ),

          const SliverToBoxAdapter(child: SizedBox(height: 16)),

          // ローディング
          if (state.isLoading)
            const SliverToBoxAdapter(
              child: Center(
                child: Padding(
                  padding: EdgeInsets.all(32.0),
                  child: CircularProgressIndicator(),
                ),
              ),
            ),

          // 提案が空
          if (!state.isLoading && state.proposals.isEmpty)
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
                      const SizedBox(height: 4),
                      Text(
                        '「提案を生成」ボタンを押してください',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: Theme.of(context).colorScheme.outline,
                            ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          // 提案カードリスト
          if (!state.isLoading && state.proposals.isNotEmpty)
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final proposal = state.proposals[index];
                  return _ProposalCard(proposal: proposal);
                },
                childCount: state.proposals.length,
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
}

class _ProposalCard extends ConsumerWidget {
  final ProposalModel proposal;

  const _ProposalCard({required this.proposal});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isPending = proposal.status == 'PENDING';
    final isConfirmed = proposal.status == 'CONFIRMED';
    final isRejected = proposal.status == 'REJECTED';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
      child: Card(
        elevation: isPending ? 2 : 0,
        color: isRejected
            ? Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: 0.5)
            : null,
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // タイプバッジ + ステータス
              Row(
                children: [
                  _TypeBadge(type: proposal.type),
                  const Spacer(),
                  if (isConfirmed)
                    Chip(
                      label: const Text('承認済み'),
                      backgroundColor:
                          Theme.of(context).colorScheme.primaryContainer,
                      labelStyle: TextStyle(
                        color: Theme.of(context).colorScheme.onPrimaryContainer,
                        fontSize: 12,
                      ),
                      visualDensity: VisualDensity.compact,
                    ),
                  if (isRejected)
                    Chip(
                      label: const Text('却下'),
                      backgroundColor:
                          Theme.of(context).colorScheme.surfaceContainerHighest,
                      labelStyle: TextStyle(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                        fontSize: 12,
                      ),
                      visualDensity: VisualDensity.compact,
                    ),
                ],
              ),
              const SizedBox(height: 8),

              // タイトル
              Text(
                proposal.title,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      decoration: isRejected
                          ? TextDecoration.lineThrough
                          : null,
                    ),
              ),

              // ボディ
              if (proposal.body != null && proposal.body!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  proposal.body!,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                ),
              ],

              // アクションボタン
              if (isPending) ...[
                const SizedBox(height: 12),
                Row(
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
              ],
            ],
          ),
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
