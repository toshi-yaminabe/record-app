import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants.dart';
import '../../data/models/task_model.dart';
import '../../data/repositories/task_repository.dart';

/// タスクリポジトリプロバイダー
final taskRepositoryProvider = Provider<TaskRepository>((ref) {
  return TaskRepository();
});

/// タスク状態
class TaskState {
  final List<TaskModel> tasks;
  final bool isLoading;
  final String? error;

  const TaskState({
    this.tasks = const [],
    this.isLoading = false,
    this.error,
  });

  TaskState copyWith({
    List<TaskModel>? tasks,
    bool? isLoading,
    String? error,
  }) {
    return TaskState(
      tasks: tasks ?? this.tasks,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// タスク状態Notifier
class TaskNotifier extends StateNotifier<TaskState> {
  final TaskRepository _repository;

  TaskNotifier(this._repository) : super(const TaskState());

  /// タスク一覧取得
  Future<void> fetchTasks({String? bunjinId, String? status}) async {
    state = state.copyWith(isLoading: true);
    try {
      final tasks = await _repository.getTasks(
        userId: AppConstants.mockUserId,
        bunjinId: bunjinId,
        status: status,
      );
      state = TaskState(tasks: tasks, isLoading: false);
    } catch (e) {
      state = TaskState(error: e.toString(), isLoading: false);
    }
  }

  /// タスク作成
  Future<void> createTask({
    required String bunjinId,
    required String title,
    String? body,
    int priority = 0,
  }) async {
    try {
      final newTask = await _repository.createTask(
        userId: AppConstants.mockUserId,
        bunjinId: bunjinId,
        title: title,
        body: body,
        priority: priority,
      );
      state = state.copyWith(tasks: [...state.tasks, newTask]);
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  /// タスクステータス更新（遷移マトリックスチェック付き）
  Future<void> updateTaskStatus(String taskId, String newStatus) async {
    final task = state.tasks.firstWhere((t) => t.id == taskId);

    // ステータス遷移チェック
    if (!TaskModel.canTransition(task.status, newStatus)) {
      state = state.copyWith(
        error: 'Invalid status transition: ${task.status} -> $newStatus',
      );
      return;
    }

    try {
      final updatedTask = await _repository.updateTask(
        taskId: taskId,
        status: newStatus,
      );

      final updatedTasks = state.tasks.map((t) {
        return t.id == taskId ? updatedTask : t;
      }).toList();

      state = state.copyWith(tasks: updatedTasks);
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  /// タスク更新
  Future<void> updateTask({
    required String taskId,
    String? title,
    String? body,
    int? priority,
  }) async {
    try {
      final updatedTask = await _repository.updateTask(
        taskId: taskId,
        title: title,
        body: body,
        priority: priority,
      );

      final updatedTasks = state.tasks.map((t) {
        return t.id == taskId ? updatedTask : t;
      }).toList();

      state = state.copyWith(tasks: updatedTasks);
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }
}

/// タスクプロバイダー
final taskNotifierProvider =
    StateNotifierProvider<TaskNotifier, TaskState>((ref) {
  final repository = ref.watch(taskRepositoryProvider);
  return TaskNotifier(repository);
});
