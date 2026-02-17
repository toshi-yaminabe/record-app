import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:flutter_app/data/repositories/authenticated_client.dart';
import 'package:flutter_app/data/repositories/task_repository.dart';

class MockAuthenticatedClient extends Mock implements AuthenticatedClient {}

void main() {
  late MockAuthenticatedClient mockClient;
  late TaskRepository repo;

  setUp(() {
    mockClient = MockAuthenticatedClient();
    repo = TaskRepository(client: mockClient);
  });

  final sampleTask = {
    'id': 't1',
    'userId': 'u1',
    'title': 'テストタスク',
    'body': null,
    'status': 'TODO',
    'priority': 50,
    'bunjinId': 'b1',
    'createdAt': '2026-01-01T00:00:00Z',
    'updatedAt': '2026-01-01T00:00:00Z',
    'archivedAt': null,
  };

  group('TaskRepository', () {
    test('getTasks returns task list', () async {
      when(() => mockClient.get('/api/tasks', context: 'タスク一覧取得'))
          .thenAnswer((_) async => {
                'tasks': [sampleTask]
              });

      final result = await repo.getTasks();
      expect(result.length, 1);
      expect(result.first.title, 'テストタスク');
    });

    test('getTasks passes query params', () async {
      when(() => mockClient.get('/api/tasks',
              queryParams: any(named: 'queryParams'),
              context: 'タスク一覧取得'))
          .thenAnswer((_) async => {'tasks': []});

      await repo.getTasks(bunjinId: 'b1', status: 'TODO');

      verify(() => mockClient.get('/api/tasks',
          queryParams: {'bunjinId': 'b1', 'status': 'TODO'},
          context: 'タスク一覧取得')).called(1);
    });

    test('createTask sends correct body', () async {
      when(() => mockClient.post('/api/tasks',
              body: any(named: 'body'), context: 'タスク作成'))
          .thenAnswer((_) async => {'task': sampleTask});

      final result = await repo.createTask(
        bunjinId: 'b1',
        title: 'テストタスク',
      );

      expect(result.status, 'TODO');
    });

    test('updateTask sends only provided fields', () async {
      final updated = {...sampleTask, 'status': 'DOING'};
      when(() => mockClient.patch('/api/tasks/t1',
              body: any(named: 'body'), context: 'タスク更新'))
          .thenAnswer((_) async => {'task': updated});

      final result = await repo.updateTask(taskId: 't1', status: 'DOING');

      expect(result.status, 'DOING');
    });

    test('getTasks returns empty for no results', () async {
      when(() => mockClient.get('/api/tasks', context: 'タスク一覧取得'))
          .thenAnswer((_) async => {'tasks': []});

      final result = await repo.getTasks();
      expect(result, isEmpty);
    });
  });
}
