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
  @override
  void initState() {
    super.initState();
    // 初回ロード
    Future.microtask(() {
      ref.read(taskNotifierProvider.notifier).fetchTasks();
      ref.read(bunjinNotifierProvider.notifier).fetchBunjins();
    });
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

    if (taskState.tasks.isEmpty) {
      return const Center(
        child: Text('タスクがありません'),
      );
    }

    return ListView.builder(
      itemCount: taskState.tasks.length,
      itemBuilder: (context, index) {
        final task = taskState.tasks[index];
        final bunjin = bunjinState.bunjins
            .where((b) => b.id == task.bunjinId)
            .firstOrNull;

        return ListTile(
          leading: Checkbox(
            value: task.status == 'DONE',
            onChanged: (checked) {
              final notifier = ref.read(taskNotifierProvider.notifier);
              if (checked == true) {
                // TODO → DOING → DONE
                if (task.status == 'TODO') {
                  notifier.updateTaskStatus(task.id, 'DOING');
                  Future.delayed(const Duration(milliseconds: 300), () {
                    notifier.updateTaskStatus(task.id, 'DONE');
                  });
                } else if (task.status == 'DOING') {
                  notifier.updateTaskStatus(task.id, 'DONE');
                }
              } else {
                // DONE → TODO
                notifier.updateTaskStatus(task.id, 'TODO');
              }
            },
          ),
          title: Text(
            task.title,
            style: task.status == 'DONE'
                ? const TextStyle(decoration: TextDecoration.lineThrough)
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
    );
  }
}
