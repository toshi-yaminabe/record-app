import '../models/task_model.dart';
import 'authenticated_client.dart';

/// タスクリポジトリ
class TaskRepository {
  final AuthenticatedClient client;

  TaskRepository({required this.client});

  /// タスク一覧取得
  Future<List<TaskModel>> getTasks({
    String? bunjinId,
    String? status,
  }) async {
    final queryParams = <String, String>{};
    if (bunjinId != null) queryParams['bunjinId'] = bunjinId;
    if (status != null) queryParams['status'] = status;

    final data = await client.get(
      '/api/tasks',
      queryParams: queryParams.isEmpty ? null : queryParams,
      context: 'タスク一覧取得',
    );

    final tasks = data['tasks'] as List;
    return tasks
        .map((t) => TaskModel.fromJson(t as Map<String, dynamic>))
        .toList();
  }

  /// タスク作成（userIdはJWTから自動取得）
  Future<TaskModel> createTask({
    required String bunjinId,
    required String title,
    String? body,
    int priority = 0,
  }) async {
    final data = await client.post('/api/tasks', body: {
      'bunjinId': bunjinId,
      'title': title,
      'body': body,
      'priority': priority,
    }, context: 'タスク作成');

    return TaskModel.fromJson(data['task'] as Map<String, dynamic>);
  }

  /// タスク更新
  Future<TaskModel> updateTask({
    required String taskId,
    String? title,
    String? body,
    String? status,
    int? priority,
  }) async {
    final updates = <String, dynamic>{};
    if (title != null) updates['title'] = title;
    if (body != null) updates['body'] = body;
    if (status != null) updates['status'] = status;
    if (priority != null) updates['priority'] = priority;

    final data = await client.patch(
      '/api/tasks/$taskId',
      body: updates,
      context: 'タスク更新',
    );

    return TaskModel.fromJson(data['task'] as Map<String, dynamic>);
  }
}
