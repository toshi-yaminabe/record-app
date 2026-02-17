import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:flutter_app/data/repositories/authenticated_client.dart';
import 'package:flutter_app/data/repositories/bunjin_repository.dart';

class MockAuthenticatedClient extends Mock implements AuthenticatedClient {}

void main() {
  late MockAuthenticatedClient mockClient;
  late BunjinRepository repo;

  setUp(() {
    mockClient = MockAuthenticatedClient();
    repo = BunjinRepository(client: mockClient);
  });

  group('BunjinRepository', () {
    test('getBunjins returns list of BunjinModel', () async {
      when(() => mockClient.get('/api/bunjins', context: '分人一覧取得'))
          .thenAnswer((_) async => {
                'bunjins': [
                  {
                    'id': 'b1',
                    'userId': 'u1',
                    'slug': 'work',
                    'displayName': '仕事モード',
                    'description': 'desc',
                    'color': '#3b82f6',
                    'icon': 'work',
                    'isDefault': true,
                  },
                ],
              });

      final result = await repo.getBunjins();
      expect(result.length, 1);
      expect(result.first.slug, 'work');
      expect(result.first.isDefault, true);
    });

    test('getBunjins returns empty list when no bunjins', () async {
      when(() => mockClient.get('/api/bunjins', context: '分人一覧取得'))
          .thenAnswer((_) async => {'bunjins': []});

      final result = await repo.getBunjins();
      expect(result, isEmpty);
    });

    test('createBunjin sends correct body', () async {
      when(() => mockClient.post('/api/bunjins',
              body: any(named: 'body'), context: '分人作成'))
          .thenAnswer((_) async => {
                'bunjin': {
                  'id': 'b2',
                  'userId': 'u1',
                  'slug': 'hobby',
                  'displayName': '趣味モード',
                  'description': null,
                  'color': '#ff5733',
                  'icon': null,
                  'isDefault': false,
                },
              });

      final result = await repo.createBunjin(
        slug: 'hobby',
        displayName: '趣味モード',
        color: '#ff5733',
      );

      expect(result.slug, 'hobby');
      expect(result.isDefault, false);
      verify(() => mockClient.post('/api/bunjins',
          body: any(named: 'body'), context: '分人作成')).called(1);
    });

    test('updateBunjin sends only provided fields', () async {
      when(() => mockClient.patch('/api/bunjins/b1',
              body: any(named: 'body'), context: '分人更新'))
          .thenAnswer((_) async => {
                'bunjin': {
                  'id': 'b1',
                  'userId': 'u1',
                  'slug': 'work',
                  'displayName': '新名前',
                  'description': null,
                  'color': '#3b82f6',
                  'icon': null,
                  'isDefault': true,
                },
              });

      final result = await repo.updateBunjin(
        bunjinId: 'b1',
        displayName: '新名前',
      );

      expect(result.displayName, '新名前');
    });

    test('deleteBunjin calls client delete', () async {
      when(() => mockClient.delete('/api/bunjins/b2', context: '分人削除'))
          .thenAnswer((_) async {});

      await repo.deleteBunjin('b2');

      verify(() => mockClient.delete('/api/bunjins/b2', context: '分人削除'))
          .called(1);
    });
  });
}
