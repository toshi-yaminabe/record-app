import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:flutter_app/core/transcribe_mode.dart';
import 'package:flutter_app/services/transcribe/server_engine.dart';
import 'package:flutter_app/services/transcribe/transcribe_engine.dart';
import 'package:flutter_app/services/transcribe/transcribe_request_context.dart';
import 'package:flutter_app/services/transcribe/transcribe_service.dart';

class MockTranscribeService extends Mock implements TranscribeService {}

void main() {
  late MockTranscribeService mockService;
  late ServerEngine serverEngine;

  final testContext = TranscribeRequestContext(
    filePath: '/tmp/test.m4a',
    deviceId: 'device-001',
    sessionId: 'session-001',
    segmentNo: 1,
    startAt: DateTime.utc(2026, 2, 18, 10, 0),
    endAt: DateTime.utc(2026, 2, 18, 10, 10),
    mode: TranscribeMode.server,
  );

  setUp(() {
    mockService = MockTranscribeService();
    serverEngine = ServerEngine(transcribeService: mockService);
  });

  group('ServerEngine', () {
    test('TranscribeServiceに委任して結果をTranscribeEngineResultに変換する', () async {
      when(() => mockService.transcribe(
            filePath: any(named: 'filePath'),
            deviceId: any(named: 'deviceId'),
            sessionId: any(named: 'sessionId'),
            segmentNo: any(named: 'segmentNo'),
            startAt: any(named: 'startAt'),
            endAt: any(named: 'endAt'),
          )).thenAnswer((_) async => TranscribeResult(
            segmentId: 'seg-123',
            text: 'テスト文字起こし結果',
          ));

      final result = await serverEngine.transcribe(testContext);

      expect(result.text, 'テスト文字起こし結果');
      expect(result.segmentId, 'seg-123');
      expect(result.selectedMode, TranscribeMode.server);
      expect(result.executedMode, TranscribeMode.server);
      expect(result.fallbackReason, isNull);

      verify(() => mockService.transcribe(
            filePath: testContext.filePath,
            deviceId: testContext.deviceId,
            sessionId: testContext.sessionId,
            segmentNo: testContext.segmentNo,
            startAt: testContext.startAt,
            endAt: testContext.endAt,
          )).called(1);
    });

    test('TranscribeServiceの例外をそのまま伝播する', () async {
      when(() => mockService.transcribe(
            filePath: any(named: 'filePath'),
            deviceId: any(named: 'deviceId'),
            sessionId: any(named: 'sessionId'),
            segmentNo: any(named: 'segmentNo'),
            startAt: any(named: 'startAt'),
            endAt: any(named: 'endAt'),
          )).thenThrow(TranscribeException(
        '文字起こし失敗 (500): Internal Server Error',
        statusCode: 500,
      ));

      expect(
        () => serverEngine.transcribe(testContext),
        throwsA(isA<TranscribeException>()),
      );
    });

    test('空テキストでも正常に結果を返す', () async {
      when(() => mockService.transcribe(
            filePath: any(named: 'filePath'),
            deviceId: any(named: 'deviceId'),
            sessionId: any(named: 'sessionId'),
            segmentNo: any(named: 'segmentNo'),
            startAt: any(named: 'startAt'),
            endAt: any(named: 'endAt'),
          )).thenAnswer((_) async => TranscribeResult(
            segmentId: 'seg-456',
            text: '',
          ));

      final result = await serverEngine.transcribe(testContext);

      expect(result.text, '');
      expect(result.segmentId, 'seg-456');
      expect(result.selectedMode, TranscribeMode.server);
    });
  });

  group('ServerEngineException', () {
    test('statusCode付きで文字列化', () {
      final ex = ServerEngineException('エラー', statusCode: 500);
      expect(ex.toString(), 'エラー (HTTP 500)');
    });

    test('statusCodeなしで文字列化', () {
      final ex = ServerEngineException('エラー');
      expect(ex.toString(), 'エラー');
    });
  });
}
