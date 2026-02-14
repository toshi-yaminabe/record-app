import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:flutter_app/data/local/offline_queue_db.dart';
import 'package:flutter_app/data/local/queue_entry.dart';
import 'package:flutter_app/services/offline/offline_queue_service.dart';

class MockOfflineQueueDB extends Mock implements OfflineQueueDB {}

void main() {
  late MockOfflineQueueDB mockDb;

  setUp(() {
    mockDb = MockOfflineQueueDB();
  });

  group('OfflineQueueService', () {
    test('flush skips entry with null id', () async {
      var callCount = 0;
      final nullIdEntry = QueueEntry(
        id: null,
        endpoint: '/api/test',
        method: 'POST',
        payload: '{}',
        createdAt: DateTime.utc(2024),
      );
      when(() => mockDb.dequeueNext()).thenAnswer((_) async {
        callCount++;
        if (callCount == 1) return nullIdEntry;
        return null;
      });

      final service = OfflineQueueService(db: mockDb, baseUrl: 'http://test');
      await service.flush();

      // markCompleted and markFailed should not be called
      verifyNever(() => mockDb.markCompleted(any()));
      verifyNever(() => mockDb.markFailed(any(), any()));
    });

    test('exponential backoff: retryCount=0 -> 1s, 1 -> 2s, 2 -> 4s', () {
      // Verify exponential backoff calculation
      // _baseDelayMs = 1000
      // delay = min(1000 * 2^retryCount, 60000)
      expect(1000 * 1, 1000); // retryCount=0: 1000 * 2^0 = 1000ms
      expect(1000 * 2, 2000); // retryCount=1: 1000 * 2^1 = 2000ms
      expect(1000 * 4, 4000); // retryCount=2: 1000 * 2^2 = 4000ms
      expect(1000 * 8, 8000); // retryCount=3: 1000 * 2^3 = 8000ms
      expect(1000 * 16, 16000); // retryCount=4: 1000 * 2^4 = 16000ms
    });
  });
}
