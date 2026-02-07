import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../core/constants.dart';
import '../../core/errors.dart';
import '../models/task_model.dart';

/// タスクリポジトリ
class TaskRepository {
  final String baseUrl;

  TaskRepository({this.baseUrl = ApiConfig.baseUrl});

  /// タスク一覧取得
  Future<List<TaskModel>> getTasks({
    required String userId,
    String? bunjinId,
    String? status,
  }) async {
    try {
      final queryParams = <String, String>{'userId': userId};
      if (bunjinId != null) queryParams['bunjinId'] = bunjinId;
      if (status != null) queryParams['status'] = status;

      final uri = Uri.parse('$baseUrl/api/tasks').replace(queryParameters: queryParams);
      final response = await http.get(uri);

      if (response.statusCode == 200) {
        final List<dynamic> jsonList = jsonDecode(response.body) as List;
        return jsonList.map((json) => TaskModel.fromJson(json as Map<String, dynamic>)).toList();
      } else {
        throw ApiException(
          'Failed to get tasks',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw NetworkException('Network error during tasks retrieval', details: e.toString());
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
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/tasks'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'userId': userId,
          'bunjinId': bunjinId,
          'title': title,
          'body': body,
          'priority': priority,
        }),
      );

      if (response.statusCode == 201) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return TaskModel.fromJson(json);
      } else {
        throw ApiException(
          'Failed to create task',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw NetworkException('Network error during task creation', details: e.toString());
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

      final response = await http.patch(
        Uri.parse('$baseUrl/api/tasks/$taskId'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(updates),
      );

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return TaskModel.fromJson(json);
      } else {
        throw ApiException(
          'Failed to update task',
          statusCode: response.statusCode,
          details: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw NetworkException('Network error during task update', details: e.toString());
    }
  }
}
