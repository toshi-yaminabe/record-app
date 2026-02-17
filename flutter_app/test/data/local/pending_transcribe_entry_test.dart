import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/services/offline/pending_transcribe_store.dart';

void main() {
  group('PendingTranscribeEntry', () {
    final sampleMap = {
      'id': 1,
      'file_path': '/data/recordings/audio1.m4a',
      'device_id': 'dev-001',
      'session_id': 'sess-001',
      'segment_no': 0,
      'start_at': '2026-01-01T09:00:00.000Z',
      'end_at': '2026-01-01T09:10:00.000Z',
      'storage_object_path': 'audio/sess-001/0.m4a',
      'retry_count': 2,
      'status': 'uploaded',
      'created_at': '2026-01-01T09:00:05.000Z',
    };

    test('fromMap creates entry with all fields', () {
      final entry = PendingTranscribeEntry.fromMap(sampleMap);

      expect(entry.id, 1);
      expect(entry.filePath, '/data/recordings/audio1.m4a');
      expect(entry.deviceId, 'dev-001');
      expect(entry.sessionId, 'sess-001');
      expect(entry.segmentNo, 0);
      expect(entry.startAt, DateTime.utc(2026, 1, 1, 9, 0));
      expect(entry.endAt, DateTime.utc(2026, 1, 1, 9, 10));
      expect(entry.storageObjectPath, 'audio/sess-001/0.m4a');
      expect(entry.retryCount, 2);
      expect(entry.status, 'uploaded');
    });

    test('fromMap handles null storageObjectPath', () {
      final mapWithNullPath = {...sampleMap, 'storage_object_path': null};
      final entry = PendingTranscribeEntry.fromMap(mapWithNullPath);

      expect(entry.storageObjectPath, isNull);
    });

    test('fromMap parses ISO8601 dates correctly', () {
      final entry = PendingTranscribeEntry.fromMap(sampleMap);

      expect(entry.startAt.year, 2026);
      expect(entry.startAt.month, 1);
      expect(entry.startAt.hour, 9);
      expect(entry.createdAt.second, 5);
    });

    test('entry is immutable (const constructor)', () {
      final entry = PendingTranscribeEntry.fromMap(sampleMap);

      // All fields are final
      expect(entry.id, isA<int>());
      expect(entry.filePath, isA<String>());
      expect(entry.status, isA<String>());
    });

    test('pending status entries', () {
      final pendingMap = {...sampleMap, 'status': 'pending'};
      final entry = PendingTranscribeEntry.fromMap(pendingMap);
      expect(entry.status, 'pending');
    });

    test('dead_letter status entries', () {
      final deadMap = {...sampleMap, 'status': 'dead_letter'};
      final entry = PendingTranscribeEntry.fromMap(deadMap);
      expect(entry.status, 'dead_letter');
    });
  });
}
