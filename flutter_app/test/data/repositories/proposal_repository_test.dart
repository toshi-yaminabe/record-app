import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:flutter_app/data/repositories/authenticated_client.dart';
import 'package:flutter_app/data/repositories/proposal_repository.dart';

class MockAuthenticatedClient extends Mock implements AuthenticatedClient {}

void main() {
  late MockAuthenticatedClient mockClient;
  late ProposalRepository repo;

  setUp(() {
    mockClient = MockAuthenticatedClient();
    repo = ProposalRepository(client: mockClient);
  });

  final sampleProposal = {
    'id': 'p1',
    'userId': 'u1',
    'dateKey': '2026-01-01',
    'type': 'TASK',
    'title': 'やること',
    'body': null,
    'status': 'PENDING',
    'createdAt': '2026-01-01T00:00:00Z',
  };

  group('ProposalRepository', () {
    test('getProposals returns proposal list', () async {
      when(() => mockClient.get('/api/proposals', context: '提案一覧取得'))
          .thenAnswer((_) async => {
                'proposals': [sampleProposal]
              });

      final result = await repo.getProposals();
      expect(result.length, 1);
    });

    test('getProposals passes dateKey filter', () async {
      when(() => mockClient.get('/api/proposals',
              queryParams: any(named: 'queryParams'), context: '提案一覧取得'))
          .thenAnswer((_) async => {'proposals': []});

      await repo.getProposals(dateKey: '2026-01-01');

      verify(() => mockClient.get('/api/proposals',
              queryParams: {'dateKey': '2026-01-01'}, context: '提案一覧取得'))
          .called(1);
    });

    test('generateProposals sends dateKey', () async {
      when(() => mockClient.post('/api/proposals',
              body: any(named: 'body'), context: '提案生成'))
          .thenAnswer((_) async => {
                'proposals': [sampleProposal]
              });

      final result = await repo.generateProposals('2026-01-01');
      expect(result.length, 1);
    });

    test('updateProposalStatus sends status', () async {
      when(() => mockClient.patch('/api/proposals/p1',
              body: any(named: 'body'), context: '提案更新'))
          .thenAnswer((_) async => {});

      await repo.updateProposalStatus('p1', 'CONFIRMED');

      verify(() => mockClient.patch('/api/proposals/p1',
          body: {'status': 'CONFIRMED'}, context: '提案更新')).called(1);
    });
  });
}
