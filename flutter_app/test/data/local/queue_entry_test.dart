import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/data/local/queue_entry.dart';

void main() {
  group('QueueEntry', () {
    group('status constants', () {
      test('statusPending equals pending', () {
        expect(QueueEntry.statusPending, 'pending');
      });
      test('statusDeadLetter equals dead_letter', () {
        expect(QueueEntry.statusDeadLetter, 'dead_letter');
      });
    });

    group('fromMap', () {
      test('creates entry from valid map', () {
        final map = {
          'id': 1,
          'endpoint': '/api/test',
          'method': 'POST',
          'payload': '{"key":"value"}',
          'created_at': '2024-01-01T00:00:00.000Z',
          'retry_count': 0,
          'status': 'pending',
        };
        final entry = QueueEntry.fromMap(map);
        expect(entry.id, 1);
        expect(entry.endpoint, '/api/test');
        expect(entry.method, 'POST');
        expect(entry.payload, '{"key":"value"}');
        expect(entry.retryCount, 0);
        expect(entry.status, 'pending');
      });

      test('throws StateError when id is null', () {
        final map = {
          'id': null,
          'endpoint': '/api/test',
          'method': 'POST',
          'payload': '{}',
          'created_at': '2024-01-01T00:00:00.000Z',
          'retry_count': 0,
          'status': 'pending',
        };
        expect(() => QueueEntry.fromMap(map), throwsStateError);
      });
    });

    group('toMap', () {
      test('round trip with fromMap', () {
        final original = QueueEntry(
          id: 42,
          endpoint: '/api/tasks',
          method: 'PATCH',
          payload: '{"status":"DONE"}',
          createdAt: DateTime.utc(2024, 6, 15, 10, 30),
          retryCount: 2,
          status: QueueEntry.statusPending,
        );
        final map = original.toMap();
        final restored = QueueEntry.fromMap(map);
        expect(restored.id, original.id);
        expect(restored.endpoint, original.endpoint);
        expect(restored.method, original.method);
        expect(restored.payload, original.payload);
        expect(restored.retryCount, original.retryCount);
        expect(restored.status, original.status);
      });
    });

    group('copyWith', () {
      test('creates new instance with changed fields', () {
        final original = QueueEntry(
          id: 1,
          endpoint: '/api/test',
          method: 'POST',
          payload: '{}',
          createdAt: DateTime.utc(2024),
        );
        final updated = original.copyWith(
          retryCount: 3,
          status: QueueEntry.statusDeadLetter,
        );
        expect(updated.retryCount, 3);
        expect(updated.status, QueueEntry.statusDeadLetter);
        expect(updated.id, original.id); // unchanged
        expect(updated.endpoint, original.endpoint); // unchanged
      });
    });
  });
}
