import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:shared_preferences/shared_preferences.dart';
import 'core/app_logger.dart';
import 'core/constants.dart';
import 'presentation/pages/home/home_page.dart';
import 'presentation/providers/recording_provider.dart';
import 'services/device/device_id_service.dart';
import 'services/offline/connectivity_monitor.dart';
import 'services/offline/offline_queue_service.dart';
import 'services/offline/pending_transcribe_store.dart';
import 'services/offline/transcribe_retry_service.dart';
import 'services/recording/background_service_initializer.dart';
import 'services/recording/notification_channel_setup.dart';
import 'services/transcribe/transcribe_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ログ基盤初期化
  await AppLogger.init();

  // H2: baseUrlが空の場合は警告ログ出力
  if (ApiConfig.baseUrl.isEmpty) {
    AppLogger.lifecycle(
      'WARNING: API_BASE_URL is empty. '
      'Build with --dart-define-from-file=env/prod.json to set it.',
    );
  }

  // deviceIdを事前解決（起動時に1回だけ）
  final deviceId = await DeviceIdService.getOrCreate();
  AppLogger.lifecycle('app starting: deviceId=$deviceId');

  // recordings dirパスをSharedPreferencesにキャッシュ
  // （バックグラウンドisolateではpath_providerが使えないため）
  final docDir = await getApplicationDocumentsDirectory();
  final recordingsDir = p.join(docDir.path, 'recordings');
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString('recordings_dir', recordingsDir);
  AppLogger.lifecycle('recordingsDir=$recordingsDir');
  AppLogger.lifecycle(
      'baseUrl=${ApiConfig.baseUrl.isEmpty ? "(empty)" : ApiConfig.baseUrl}');

  // 通知チャネル初期化
  await NotificationChannelSetup.initialize();

  // バックグラウンドサービス初期化
  await BackgroundServiceInitializer.initialize();

  // H3: Provider経由でサービスをまとめて初期化
  // OfflineQueueService / PendingTranscribeStore / TranscribeRetryService は
  // recording_provider.dart のProviderで定義済み。
  // ConnectivityMonitor にも同じインスタンスを渡す。
  final offlineQueueService = OfflineQueueService();
  final pendingTranscribeStore = PendingTranscribeStore();
  final transcribeRetryService = TranscribeRetryService(
    store: pendingTranscribeStore,
    transcribeService: TranscribeService(baseUrl: ApiConfig.baseUrl),
  );

  final connectivityMonitor = ConnectivityMonitor(
    queueService: offlineQueueService,
    transcribeRetryService: transcribeRetryService,
  );
  connectivityMonitor.startMonitoring();

  runApp(ProviderScope(
    overrides: [
      deviceIdProvider.overrideWith((_) async => deviceId),
      offlineQueueServiceProvider.overrideWithValue(offlineQueueService),
      pendingTranscribeStoreProvider
          .overrideWithValue(pendingTranscribeStore),
    ],
    child: const MyApp(),
  ));
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '録音アプリ',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
      ),
      home: const HomePage(),
    );
  }
}
