import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/data/local/local_transcribe_store.dart';

void main() {
  group('LocalTranscribeEntry', () {
    test('fromMap で正しくパースされる', () {
      final map = {
        'id': 1,
        'session_id': 'sess-123',
        'segment_no': 0,
        'start_at': '2026-02-17T10:00:00.000Z',
        'end_at': '2026-02-17T10:05:00.000Z',
        'text': 'こんにちは',
        'selected_mode': 'SERVER',
        'executed_mode': 'SERVER',
        'fallback_reason': null,
        'local_engine_version': null,
        'retry_count': 0,
        'sync_status': 'pending',
        'created_at': '2026-02-17T10:05:01.000Z',
      };

      final entry = LocalTranscribeEntry.fromMap(map);

      expect(entry.id, 1);
      expect(entry.sessionId, 'sess-123');
      expect(entry.segmentNo, 0);
      expect(entry.text, 'こんにちは');
      expect(entry.selectedMode, 'SERVER');
      expect(entry.executedMode, 'SERVER');
      expect(entry.fallbackReason, isNull);
      expect(entry.localEngineVersion, isNull);
      expect(entry.retryCount, 0);
      expect(entry.syncStatus, 'pending');
    });

    test('fromMap でフォールバック情報付きをパースできる', () {
      final map = {
        'id': 2,
        'session_id': 'sess-456',
        'segment_no': 1,
        'start_at': '2026-02-17T10:05:00.000Z',
        'end_at': '2026-02-17T10:10:00.000Z',
        'text': 'テスト',
        'selected_mode': 'LOCAL',
        'executed_mode': 'SERVER',
        'fallback_reason': 'model not available',
        'local_engine_version': null,
        'retry_count': 2,
        'sync_status': 'pending',
        'created_at': '2026-02-17T10:10:01.000Z',
      };

      final entry = LocalTranscribeEntry.fromMap(map);

      expect(entry.selectedMode, 'LOCAL');
      expect(entry.executedMode, 'SERVER');
      expect(entry.fallbackReason, 'model not available');
      expect(entry.retryCount, 2);
    });

    test('fromMap でローカルエンジン情報付きをパースできる', () {
      final map = {
        'id': 3,
        'session_id': 'sess-789',
        'segment_no': 2,
        'start_at': '2026-02-17T10:10:00.000Z',
        'end_at': '2026-02-17T10:15:00.000Z',
        'text': 'ローカルテスト',
        'selected_mode': 'LOCAL',
        'executed_mode': 'LOCAL',
        'fallback_reason': null,
        'local_engine_version': 'whisper-1.0.0',
        'retry_count': 0,
        'sync_status': 'pending',
        'created_at': '2026-02-17T10:15:01.000Z',
      };

      final entry = LocalTranscribeEntry.fromMap(map);

      expect(entry.selectedMode, 'LOCAL');
      expect(entry.executedMode, 'LOCAL');
      expect(entry.localEngineVersion, 'whisper-1.0.0');
    });
  });
}
