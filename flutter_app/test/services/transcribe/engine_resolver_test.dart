import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:flutter_app/core/transcribe_mode.dart';
import 'package:flutter_app/services/transcribe/engine_resolver.dart';
import 'package:flutter_app/services/transcribe/server_engine.dart';
import 'package:flutter_app/services/transcribe/transcribe_engine.dart';
import 'package:flutter_app/services/transcribe/transcribe_request_context.dart';

class MockServerEngine extends Mock implements ServerEngine {}

class MockTranscribeEngine extends Mock implements TranscribeEngine {}

class FakeTranscribeRequestContext extends Fake
    implements TranscribeRequestContext {}

void main() {
  late MockServerEngine mockServerEngine;
  late EngineResolver resolver;

  setUpAll(() {
    registerFallbackValue(FakeTranscribeRequestContext());
  });

  setUp(() {
    mockServerEngine = MockServerEngine();
    resolver = EngineResolver(serverEngine: mockServerEngine);
  });

  group('EngineResolver', () {
    test('SERVER mode では ServerEngine を返す', () {
      final engine = resolver.resolve(TranscribeMode.server);
      expect(engine, same(mockServerEngine));
    });

    test('LOCAL mode でローカルエンジン未登録時は ServerEngine を返す', () {
      final engine = resolver.resolve(TranscribeMode.local);
      expect(engine, same(mockServerEngine));
    });

    test('LOCAL mode でローカルエンジン登録済み時はローカルエンジンを返す', () {
      final mockLocalEngine = MockTranscribeEngine();
      resolver.registerLocalEngine(mockLocalEngine);

      final engine = resolver.resolve(TranscribeMode.local);
      expect(engine, same(mockLocalEngine));
    });

    test('isLocalEngineAvailable は初期状態で false', () {
      expect(resolver.isLocalEngineAvailable, isFalse);
    });

    test('isLocalEngineAvailable は登録後に true', () {
      resolver.registerLocalEngine(MockTranscribeEngine());
      expect(resolver.isLocalEngineAvailable, isTrue);
    });

    test('コンストラクタでlocalEngineを注入できる', () {
      final mockLocalEngine = MockTranscribeEngine();
      final resolverWithLocal = EngineResolver(
        serverEngine: mockServerEngine,
        localEngine: mockLocalEngine,
      );

      expect(resolverWithLocal.isLocalEngineAvailable, isTrue);
      final engine = resolverWithLocal.resolve(TranscribeMode.local);
      expect(engine, same(mockLocalEngine));
    });
  });
}
