import 'dart:async';
import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_app/services/offline/connectivity_monitor.dart';
import 'package:flutter_app/services/offline/offline_queue_service.dart';
import 'package:flutter_app/services/offline/transcribe_retry_service.dart';

class MockOfflineQueueService extends Mock implements OfflineQueueService {}

class MockTranscribeRetryService extends Mock implements TranscribeRetryService {}

class MockConnectivity extends Mock implements Connectivity {}

void main() {
  late MockOfflineQueueService mockQueueService;
  late MockTranscribeRetryService mockRetryService;
  late MockConnectivity mockConnectivity;
  late StreamController<List<ConnectivityResult>> connectivityController;

  setUp(() {
    mockQueueService = MockOfflineQueueService();
    mockRetryService = MockTranscribeRetryService();
    mockConnectivity = MockConnectivity();
    connectivityController =
        StreamController<List<ConnectivityResult>>.broadcast();

    when(() => mockConnectivity.onConnectivityChanged)
        .thenAnswer((_) => connectivityController.stream);
    when(() => mockConnectivity.checkConnectivity())
        .thenAnswer((_) async => [ConnectivityResult.wifi]);
    when(() => mockQueueService.flush()).thenAnswer((_) async {});
    when(() => mockRetryService.retryPending()).thenAnswer((_) async {});
  });

  tearDown(() {
    connectivityController.close();
  });

  group('ConnectivityMonitor', () {
    test('debounce: rapid events coalesce into one', () {
      fakeAsync((async) {
        final monitor = ConnectivityMonitor(
          queueService: mockQueueService,
          transcribeRetryService: mockRetryService,
          connectivity: mockConnectivity,
        );

        // Initial check: online -> _wasOffline = false
        monitor.startMonitoring();
        async.elapse(const Duration(seconds: 2));

        // Go offline first
        connectivityController.add([ConnectivityResult.none]);
        async.elapse(const Duration(seconds: 2));

        // Rapid online events (3 times)
        connectivityController.add([ConnectivityResult.wifi]);
        async.elapse(const Duration(milliseconds: 500));
        connectivityController.add([ConnectivityResult.wifi]);
        async.elapse(const Duration(milliseconds: 500));
        connectivityController.add([ConnectivityResult.wifi]);
        async.elapse(const Duration(seconds: 2));

        // flush should be called only once (debounced)
        verify(() => mockQueueService.flush()).called(1);

        monitor.stopMonitoring();
      });
    });

    test('OFFLINE -> ONLINE triggers flush and retryPending', () {
      fakeAsync((async) {
        final monitor = ConnectivityMonitor(
          queueService: mockQueueService,
          transcribeRetryService: mockRetryService,
          connectivity: mockConnectivity,
        );

        monitor.startMonitoring();
        async.elapse(const Duration(seconds: 2));

        // Go offline
        connectivityController.add([ConnectivityResult.none]);
        async.elapse(const Duration(seconds: 2));

        // Come back online
        connectivityController.add([ConnectivityResult.wifi]);
        async.elapse(const Duration(seconds: 2));

        verify(() => mockQueueService.flush()).called(1);
        verify(() => mockRetryService.retryPending()).called(1);

        monitor.stopMonitoring();
      });
    });

    test('ONLINE -> ONLINE does not trigger flush', () {
      fakeAsync((async) {
        final monitor = ConnectivityMonitor(
          queueService: mockQueueService,
          transcribeRetryService: mockRetryService,
          connectivity: mockConnectivity,
        );

        monitor.startMonitoring();
        async.elapse(const Duration(seconds: 2));

        // Already online, send another online event
        connectivityController.add([ConnectivityResult.wifi]);
        async.elapse(const Duration(seconds: 2));

        // flush should not be called
        verifyNever(() => mockQueueService.flush());

        monitor.stopMonitoring();
      });
    });
  });
}
