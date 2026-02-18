import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:whisper_ggml/whisper_ggml.dart' as whisper;
import 'package:whisper_ggml/src/models/whisper_result.dart' as whisper_result;
import 'package:flutter_app/core/transcribe_mode.dart';
import 'package:flutter_app/services/transcribe/audio_converter.dart';
import 'package:flutter_app/services/transcribe/server_engine.dart';
import 'package:flutter_app/services/transcribe/transcribe_engine.dart';
import 'package:flutter_app/services/transcribe/transcribe_request_context.dart';
import 'package:flutter_app/services/transcribe/transcribe_service.dart';
import 'package:flutter_app/services/transcribe/whisper_engine.dart';
import 'package:flutter_app/services/transcribe/whisper_model_manager.dart';

class MockWhisperModelManager extends Mock implements WhisperModelManager {}

class MockAudioConverter extends Mock implements AudioConverter {}

class MockServerEngine extends Mock implements ServerEngine {}

class MockWhisperController extends Mock implements whisper.WhisperController {}

class FakeTranscribeRequestContext extends Fake
    implements TranscribeRequestContext {}

void main() {
  late MockWhisperModelManager mockModelManager;
  late MockAudioConverter mockAudioConverter;
  late MockServerEngine mockServerEngine;
  late MockWhisperController mockController;
  late WhisperEngine whisperEngine;

  final testContext = TranscribeRequestContext(
    filePath: '/tmp/test.m4a',
    deviceId: 'device-001',
    sessionId: 'session-001',
    segmentNo: 1,
    startAt: DateTime.utc(2026, 2, 18, 10, 0),
    endAt: DateTime.utc(2026, 2, 18, 10, 10),
  );

  setUpAll(() {
    registerFallbackValue(FakeTranscribeRequestContext());
    registerFallbackValue(whisper.WhisperModel.small);
  });

  setUp(() {
    mockModelManager = MockWhisperModelManager();
    mockAudioConverter = MockAudioConverter();
    mockServerEngine = MockServerEngine();
    mockController = MockWhisperController();

    when(() => mockModelManager.model).thenReturn(whisper.WhisperModel.small);
    when(() => mockModelManager.versionString)
        .thenReturn('whisper_ggml:small');
    when(() => mockModelManager.ensureReady()).thenAnswer((_) async {});

    whisperEngine = WhisperEngine(
      modelManager: mockModelManager,
      audioConverter: mockAudioConverter,
      serverEngine: mockServerEngine,
      controller: mockController,
    );
  });

  group('WhisperEngine ローカル文字起こし成功', () {
    test('正常フロー: 変換→文字起こし→結果返却', () async {
      when(() => mockAudioConverter.convertToWav(any()))
          .thenAnswer((_) async => '/tmp/test.wav');

      when(() => mockController.transcribe(
            model: any(named: 'model'),
            audioPath: any(named: 'audioPath'),
            lang: any(named: 'lang'),
          )).thenAnswer((_) async => whisper_result.TranscribeResult(
            transcription: whisper.WhisperTranscribeResponse(
              type: 'transcribe',
              text: 'ローカル文字起こし結果',
              segments: null,
            ),
            time: const Duration(seconds: 5),
          ));

      final result = await whisperEngine.transcribe(testContext);

      expect(result.text, 'ローカル文字起こし結果');
      expect(result.selectedMode, TranscribeMode.local);
      expect(result.executedMode, TranscribeMode.local);
      expect(result.localEngineVersion, 'whisper_ggml:small');
      expect(result.fallbackReason, isNull);
      expect(result.segmentId, isNull);

      verify(() => mockModelManager.ensureReady()).called(1);
      verify(() => mockAudioConverter.convertToWav('/tmp/test.m4a')).called(1);
      verify(() => mockController.transcribe(
            model: whisper.WhisperModel.small,
            audioPath: '/tmp/test.wav',
            lang: 'ja',
          )).called(1);
    });

    test('null結果でも空文字で返す', () async {
      when(() => mockAudioConverter.convertToWav(any()))
          .thenAnswer((_) async => '/tmp/test.wav');

      when(() => mockController.transcribe(
            model: any(named: 'model'),
            audioPath: any(named: 'audioPath'),
            lang: any(named: 'lang'),
          )).thenAnswer((_) async => null);

      final result = await whisperEngine.transcribe(testContext);

      expect(result.text, '');
      expect(result.executedMode, TranscribeMode.local);
    });
  });

  group('WhisperEngine フォールバック', () {
    test('ローカル失敗時にServerEngineにフォールバック', () async {
      when(() => mockAudioConverter.convertToWav(any()))
          .thenThrow(AudioConverterException('変換失敗'));

      when(() => mockServerEngine.transcribe(any())).thenAnswer(
        (_) async => const TranscribeEngineResult(
          text: 'サーバー文字起こし結果',
          selectedMode: TranscribeMode.server,
          executedMode: TranscribeMode.server,
          segmentId: 'seg-fallback',
        ),
      );

      final result = await whisperEngine.transcribe(testContext);

      expect(result.text, 'サーバー文字起こし結果');
      expect(result.selectedMode, TranscribeMode.local);
      expect(result.executedMode, TranscribeMode.server);
      expect(result.fallbackReason, contains('変換失敗'));
      expect(result.segmentId, 'seg-fallback');

      verify(() => mockServerEngine.transcribe(testContext)).called(1);
    });

    test('Whisper文字起こし失敗時にServerEngineにフォールバック', () async {
      when(() => mockAudioConverter.convertToWav(any()))
          .thenAnswer((_) async => '/tmp/test.wav');

      when(() => mockController.transcribe(
            model: any(named: 'model'),
            audioPath: any(named: 'audioPath'),
            lang: any(named: 'lang'),
          )).thenThrow(Exception('Whisper crashed'));

      when(() => mockServerEngine.transcribe(any())).thenAnswer(
        (_) async => const TranscribeEngineResult(
          text: 'サーバー結果',
          selectedMode: TranscribeMode.server,
          executedMode: TranscribeMode.server,
        ),
      );

      final result = await whisperEngine.transcribe(testContext);

      expect(result.executedMode, TranscribeMode.server);
      expect(result.fallbackReason, contains('Whisper crashed'));
    });

    test('フォールバックも失敗したら例外が伝播', () async {
      when(() => mockAudioConverter.convertToWav(any()))
          .thenThrow(AudioConverterException('変換失敗'));

      when(() => mockServerEngine.transcribe(any()))
          .thenThrow(TranscribeException('サーバーも失敗'));

      expect(
        () => whisperEngine.transcribe(testContext),
        throwsA(isA<TranscribeException>()),
      );
    });
  });

  group('WhisperEngine FR-011準拠', () {
    test('ローカル成功時は音声をサーバーに送信しない', () async {
      when(() => mockAudioConverter.convertToWav(any()))
          .thenAnswer((_) async => '/tmp/test.wav');

      when(() => mockController.transcribe(
            model: any(named: 'model'),
            audioPath: any(named: 'audioPath'),
            lang: any(named: 'lang'),
          )).thenAnswer((_) async => whisper_result.TranscribeResult(
            transcription: whisper.WhisperTranscribeResponse(
              type: 'transcribe',
              text: 'ローカル',
              segments: null,
            ),
            time: const Duration(seconds: 3),
          ));

      await whisperEngine.transcribe(testContext);

      verifyNever(() => mockServerEngine.transcribe(any()));
    });
  });
}
