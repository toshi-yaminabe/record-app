import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/task_provider.dart';
import '../../providers/bunjin_provider.dart';
import '../../widgets/status_badge.dart';
import '../../widgets/bunjin_chip.dart';

/// タスク一覧ページ
class TaskListPage extends ConsumerStatefulWidget {
  const TaskListPage({super.key});

  @override
  ConsumerState<TaskListPage> createState() => _TaskListPageState();
}

class _TaskListPageState extends ConsumerState<TaskListPage> {
  /// 選択中の分人ID（null = すべて）
  String? _selectedBunjinId;

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(taskNotifierProvider.notifier).fetchTasks();
      ref.read(bunjinNotifierProvider.notifier).fetchBunjins();
    });
  }

  Color _parseColor(String hex) {
    final clean = hex.replaceFirst('#', '');
    final value = int.tryParse(clean, radix: 16);
    if (value == null) return Colors.grey;
    return Color(0xFF000000 | value);
  }

  @override
  Widget build(BuildContext context) {
    final taskState = ref.watch(taskNotifierProvider);
    final bunjinState = ref.watch(bunjinNotifierProvider);

    if (taskState.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (taskState.error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('エラー: ${taskState.error}'),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                ref.read(taskNotifierProvider.notifier).fetchTasks();
              },
              child: const Text('再試行'),
            ),
          ],
        ),
      );
    }

    // 選択中の分人でフィルタリング
    final filteredTasks = _selectedBunjinId == null
        ? taskState.tasks
        : taskState.tasks.where((t) => t.bunjinId == _selectedBunjinId).toList();

    return Column(
      children: [
        // 分人フィルターチップ（横スクロール）
        if (bunjinState.bunjins.isNotEmpty)
          SizedBox(
            height: 52,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              children: [
                // 「すべて」チップ
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: FilterChip(
                    label: const Text('すべて'),
                    selected: _selectedBunjinId == null,
                    onSelected: (_) {
                      setState(() => _selectedBunjinId = null);
                    },
                  ),
                ),
                // 各分人チップ
                ...bunjinState.bunjins.map((bunjin) {
                  final color = _parseColor(bunjin.color);
                  final isSelected = _selectedBunjinId == bunjin.id;
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: FilterChip(
                      label: Text(bunjin.displayName),
                      selected: isSelected,
                      selectedColor: color.withValues(alpha: 0.25),
                      checkmarkColor: color,
                      side: BorderSide(
                        color: isSelected
                            ? color
                            : Theme.of(context).colorScheme.outline,
                      ),
                      labelStyle: TextStyle(
                        color: isSelected ? color : null,
                        fontWeight: isSelected ? FontWeight.w600 : null,
                      ),
                      onSelected: (_) {
                        setState(() {
                          _selectedBunjinId =
                              isSelected ? null : bunjin.id;
                        });
                      },
                    ),
                  );
                }),
              ],
            ),
          ),

        // タスク一覧
        Expanded(
          child: filteredTasks.isEmpty
              ? const Center(child: Text('タスクがありません'))
              : ListView.builder(
                  itemCount: filteredTasks.length,
                  itemBuilder: (context, index) {
                    final task = filteredTasks[index];
                    final bunjin = bunjinState.bunjins
                        .where((b) => b.id == task.bunjinId)
                        .firstOrNull;

                    return ListTile(
                      leading: Checkbox(
                        value: task.status == 'DONE',
                        onChanged: (checked) {
                          final notifier =
                              ref.read(taskNotifierProvider.notifier);
                          if (checked == true) {
                            if (task.status == 'TODO') {
                              notifier.updateTaskStatus(task.id, 'DOING');
                              Future.delayed(
                                const Duration(milliseconds: 300),
                                () => notifier.updateTaskStatus(
                                    task.id, 'DONE'),
                              );
                            } else if (task.status == 'DOING') {
                              notifier.updateTaskStatus(task.id, 'DONE');
                            }
                          } else {
                            notifier.updateTaskStatus(task.id, 'TODO');
                          }
                        },
                      ),
                      title: Text(
                        task.title,
                        style: task.status == 'DONE'
                            ? const TextStyle(
                                decoration: TextDecoration.lineThrough)
                            : null,
                      ),
                      subtitle: bunjin != null
                          ? Padding(
                              padding: const EdgeInsets.only(top: 4.0),
                              child: BunjinChip(bunjin: bunjin),
                            )
                          : null,
                      trailing: StatusBadge(status: task.status),
                      onTap: () {
                        // タスク詳細画面への遷移（未実装）
                      },
                    );
                  },
                ),
        ),
      ],
    );
  }
}
