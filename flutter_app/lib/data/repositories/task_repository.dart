import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../core/app_logger.dart';
import '../../core/constants.dart';
import '../../core/errors.dart';
import '../models/task_model.dart';

/// タスクリポジトリ
class TaskRepository {
  final String baseUrl;

  TaskRepository({this.baseUrl = ApiConfig.baseUrl});

  /// タスク一覧取得
  Future<List<TaskModel>> getTasks({
    String? bunjinId,
    String? status,
  }) async {
    try {
      final queryParams = <String, String>{};
      if (bunjinId != null) queryParams['bunjinId'] = bunjinId;
      if (status != null) queryParams['status'] = status;

      final uri = Uri.parse('$baseUrl/api/tasks')
          .replace(queryParameters: queryParams.isEmpty ? null : queryParams);
      AppLogger.api('GET $uri');
      final response = await http.get(uri);
      AppLogger.api('GET /api/tasks -> ${response.statusCode}');

      if (response.statusCode == 200) {
        // S1: エンベロープ展開 — バックエンドは { tasks: [...] } で返す
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        final List<dynamic> tasks = json['tasks'] as List;
        return tasks
            .map((t) => TaskModel.fromJson(t as Map<String, dynamic>))
            .toList();
      } else {
        throw ApiException(
          'Failed to get tasks',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e, stackTrace) {
      if (e is ApiException) rethrow;
      AppLogger.api('GET /api/tasks FAILED', error: e, stack: stackTrace);
      throw NetworkException('Network error during tasks retrieval',
          details: e.toString());
    }
  }

  /// タスク作成
  Future<TaskModel> createTask({
    required String userId,
    required String bunjinId,
    required String title,
    String? body,
    int priority = 0,
  }) async {
    final bodyJson = jsonEncode({
      'userId': userId,
      'bunjinId': bunjinId,
      'title': title,
      'body': body,
      'priority': priority,
    });

    try {
      AppLogger.api('POST /api/tasks body=$bodyJson');
      final response = await http.post(
        Uri.parse('$baseUrl/api/tasks'),
        headers: {'Content-Type': 'application/json'},
        body: bodyJson,
      );
      AppLogger.api('POST /api/tasks -> ${response.statusCode}');

      if (response.statusCode == 201) {
        // S1: エンベロープ展開 — バックエンドは { task: {...} } で返す
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return TaskModel.fromJson(json['task'] as Map<String, dynamic>);
      } else {
        throw ApiException(
          'Failed to create task',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e, stackTrace) {
      if (e is ApiException) rethrow;
      AppLogger.api('POST /api/tasks FAILED', error: e, stack: stackTrace);
      throw NetworkException('Network error during task creation',
          details: e.toString());
    }
  }

  /// タスク更新
  Future<TaskModel> updateTask({
    required String taskId,
    String? title,
    String? body,
    String? status,
    int? priority,
  }) async {
    try {
      final updates = <String, dynamic>{};
      if (title != null) updates['title'] = title;
      if (body != null) updates['body'] = body;
      if (status != null) updates['status'] = status;
      if (priority != null) updates['priority'] = priority;

      final bodyJson = jsonEncode(updates);
      AppLogger.api('PATCH /api/tasks/$taskId body=$bodyJson');

      final response = await http.patch(
        Uri.parse('$baseUrl/api/tasks/$taskId'),
        headers: {'Content-Type': 'application/json'},
        body: bodyJson,
      );
      AppLogger.api('PATCH /api/tasks/$taskId -> ${response.statusCode}');

      if (response.statusCode == 200) {
        // S1: エンベロープ展開 — バックエンドは { task: {...} } で返す
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return TaskModel.fromJson(json['task'] as Map<String, dynamic>);
      } else {
        throw ApiException(
          'Failed to update task',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e, stackTrace) {
      if (e is ApiException) rethrow;
      AppLogger.api('PATCH /api/tasks/$taskId FAILED',
          error: e, stack: stackTrace);
      throw NetworkException('Network error during task update',
          details: e.toString());
    }
  }
}
