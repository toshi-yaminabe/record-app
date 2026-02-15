import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/app_logger.dart';
import 'core/constants.dart';
import 'data/repositories/authenticated_client.dart';
import 'presentation/pages/auth/login_page.dart';
import 'presentation/pages/home/home_page.dart';
import 'presentation/providers/auth_provider.dart';
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

  // H2: baseUrlが空の場合はアプリ起動をブロック
  if (ApiConfig.baseUrl.isEmpty) {
    AppLogger.lifecycle(
      'SEVERE: API_BASE_URL is empty. '
      'Build with --dart-define-from-file=env/prod.json to set it.',
    );
    assert(false, 'API_BASE_URL is not configured. Cannot start app.');
    runApp(const ConfigErrorApp());
    return;
  }

  // Supabase初期化
  if (SupabaseConfig.url.isNotEmpty && SupabaseConfig.anonKey.isNotEmpty) {
    await Supabase.initialize(
      url: SupabaseConfig.url,
      anonKey: SupabaseConfig.anonKey,
    );
    AppLogger.lifecycle('supabase: initialized url=${SupabaseConfig.url}');
  } else {
    AppLogger.lifecycle(
      'WARNING: SUPABASE_URL or SUPABASE_ANON_KEY is empty. '
      'Auth features will not work.',
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
  final authenticatedClient = AuthenticatedClient(baseUrl: ApiConfig.baseUrl);
  final offlineQueueService = OfflineQueueService();
  final pendingTranscribeStore = PendingTranscribeStore();
  final transcribeService = TranscribeService(baseUrl: ApiConfig.baseUrl);
  final transcribeRetryService = TranscribeRetryService(
    store: pendingTranscribeStore,
    transcribeService: transcribeService,
  );

  final connectivityMonitor = ConnectivityMonitor(
    queueService: offlineQueueService,
    transcribeRetryService: transcribeRetryService,
  );
  connectivityMonitor.startMonitoring();

  runApp(ProviderScope(
    overrides: [
      deviceIdProvider.overrideWithValue(deviceId),
      offlineQueueServiceProvider.overrideWithValue(offlineQueueService),
      pendingTranscribeStoreProvider
          .overrideWithValue(pendingTranscribeStore),
      authenticatedClientProvider.overrideWithValue(authenticatedClient),
      transcribeServiceProvider.overrideWithValue(transcribeService),
    ],
    child: const MyApp(),
  ));
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider);

    return MaterialApp(
      title: '録音アプリ',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
      ),
      // Auth導入後に LoginPage 分岐を復活
      // : authState.isAuthenticated ? const HomePage() : const LoginPage(),
      home: authState.isLoading
          ? const _SplashScreen()
          : const HomePage(),
    );
  }
}

/// スプラッシュ画面（認証状態確認中）
class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(),
      ),
    );
  }
}

/// API_BASE_URL未設定時のエラー画面
class ConfigErrorApp extends StatelessWidget {
  const ConfigErrorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, size: 64, color: Colors.red),
                const SizedBox(height: 16),
                const Text(
                  '設定エラー',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  'API_BASE_URL が設定されていません。\n'
                  '--dart-define-from-file=env/prod.json を指定してビルドしてください。',
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
