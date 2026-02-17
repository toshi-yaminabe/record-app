import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:flutter_app/data/repositories/authenticated_client.dart';
import 'package:flutter_app/data/repositories/session_repository.dart';

class MockAuthenticatedClient extends Mock implements AuthenticatedClient {}

void main() {
  late MockAuthenticatedClient mockClient;
  late SessionRepository repo;

  setUp(() {
    mockClient = MockAuthenticatedClient();
    repo = SessionRepository(client: mockClient);
  });

  final sampleSession = {
    'id': 's1',
    'userId': 'u1',
    'deviceId': 'dev1',
    'status': 'ACTIVE',
    'startedAt': '2026-01-01T00:00:00Z',
    'endedAt': null,
    'createdAt': '2026-01-01T00:00:00Z',
    'updatedAt': '2026-01-01T00:00:00Z',
  };

  group('SessionRepository', () {
    test('createSession sends deviceId', () async {
      when(() => mockClient.post('/api/sessions',
              body: any(named: 'body'), context: 'セッション作成'))
          .thenAnswer((_) async => {'session': sampleSession});

      final result = await repo.createSession(deviceId: 'dev1');
      expect(result.status, 'ACTIVE');
      expect(result.deviceId, 'dev1');
    });

    test('getSession fetches by id', () async {
      when(() => mockClient.get('/api/sessions/s1', context: 'セッション取得'))
          .thenAnswer((_) async => {'session': sampleSession});

      final result = await repo.getSession('s1');
      expect(result.id, 's1');
    });

    test('completeSession sends STOPPED status', () async {
      final stopped = {...sampleSession, 'status': 'STOPPED'};
      when(() => mockClient.patch('/api/sessions/s1',
              body: any(named: 'body'), context: 'セッション完了'))
          .thenAnswer((_) async => {'session': stopped});

      final result = await repo.completeSession('s1');
      expect(result.status, 'STOPPED');
    });

    test('getUserSessions returns list', () async {
      when(() =>
              mockClient.get('/api/sessions', context: 'セッション一覧取得'))
          .thenAnswer((_) async => {
                'sessions': [sampleSession]
              });

      final result = await repo.getUserSessions();
      expect(result.length, 1);
      expect(result.first.id, 's1');
    });

    test('getUserSessions returns empty list', () async {
      when(() =>
              mockClient.get('/api/sessions', context: 'セッション一覧取得'))
          .thenAnswer((_) async => {'sessions': []});

      final result = await repo.getUserSessions();
      expect(result, isEmpty);
    });
  });
}
