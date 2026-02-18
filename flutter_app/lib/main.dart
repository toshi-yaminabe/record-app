import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/app_logger.dart';
import 'core/constants.dart';
import 'data/repositories/authenticated_client.dart';
import 'presentation/pages/auth/login_page.dart';
import 'presentation/pages/auth/transcribe_mode_selection_page.dart';
import 'presentation/pages/home/home_page.dart';
import 'presentation/providers/auth_provider.dart';
import 'presentation/providers/recording_provider.dart';
import 'presentation/providers/transcribe_mode_provider.dart';
import 'services/device/device_id_service.dart';
import 'services/offline/connectivity_monitor.dart';
import 'services/offline/offline_queue_service.dart';
import 'services/offline/pending_transcribe_store.dart';
import 'services/offline/transcribe_retry_service.dart';
import 'data/local/migration_helper.dart';
import 'data/local/secure_db_key_manager.dart';
import 'data/local/unified_queue_database.dart';
import 'data/local/local_transcribe_store.dart';
import 'services/recording/background_service_initializer.dart';
import 'services/recording/notification_channel_setup.dart';
import 'services/transcribe/engine_resolver.dart';
import 'services/transcribe/local_transcribe_sync_service.dart';
import 'services/transcribe/audio_converter.dart';
import 'services/transcribe/server_engine.dart';
import 'services/transcribe/transcribe_quality_evaluator.dart';
import 'services/transcribe/transcribe_service.dart';
import 'services/transcribe/whisper_engine.dart';
import 'services/transcribe/whisper_model_manager.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // グローバルエラーハンドラ
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    // AppLoggerが初期化済みならログ出力
    try {
      AppLogger.lifecycle('FlutterError: ${details.exceptionAsString()}');
    } catch (_) {}
  };

  runZonedGuarded(
    () async {
      try {
        await _initializeAndRunApp();
      } catch (e, st) {
        try {
          AppLogger.lifecycle('FATAL: initialization failed: $e\n$st');
        } catch (_) {}
        runApp(InitializationErrorApp(error: e.toString()));
      }
    },
    (error, stackTrace) {
      try {
        AppLogger.lifecycle('Uncaught zone error: $error\n$stackTrace');
      } catch (_) {}
    },
  );
}

Future<void> _initializeAndRunApp() async {
  // === Block 1: コア初期化 ===
  final packageInfo = await PackageInfo.fromPlatform();
  await AppLogger.init(packageInfo: packageInfo);
  AppLogger.lifecycle(
    'app version=${packageInfo.version} '
    'build=${packageInfo.buildNumber} '
    'package=${packageInfo.packageName}',
  );

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
  final docDir = await getApplicationDocumentsDirectory();
  final recordingsDir = p.join(docDir.path, 'recordings');
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString('recordings_dir', recordingsDir);
  AppLogger.lifecycle('recordingsDir=$recordingsDir');
  AppLogger.lifecycle(
      'baseUrl=${ApiConfig.baseUrl.isEmpty ? "(empty)" : ApiConfig.baseUrl}');

  // === Block 2: サービス初期化（一部失敗は続行） ===
  try {
    await NotificationChannelSetup.initialize();
  } catch (e, st) {
    AppLogger.lifecycle('WARNING: notification init failed: $e\n$st');
  }

  try {
    await BackgroundServiceInitializer.initialize();
  } catch (e, st) {
    AppLogger.lifecycle('WARNING: background service init failed: $e\n$st');
  }

  // DB暗号化キー取得 + マイグレーション
  final dbKey = await SecureDbKeyManager.getOrCreateKey();
  await MigrationHelper.migrateIfNeeded();
  await MigrationHelper.migrateToEncrypted(dbKey);
  UnifiedQueueDatabase.setPassword(dbKey);

  // === Block 3: DI構成 ===
  final authenticatedClient = AuthenticatedClient(baseUrl: ApiConfig.baseUrl);
  final offlineQueueService = OfflineQueueService();
  final pendingTranscribeStore = PendingTranscribeStore();

  final transcribeService = TranscribeService(baseUrl: ApiConfig.baseUrl);
  final serverEngine = ServerEngine(transcribeService: transcribeService);

  // ローカルSTTエンジンはファクトリで遅延生成（モード選択まで初期化しない）
  final engineResolver = EngineResolver(
    serverEngine: serverEngine,
    localEngineFactory: () {
      final modelManager = WhisperModelManager();
      const audioConverter = AudioConverter();
      return WhisperEngine(
        modelManager: modelManager,
        audioConverter: audioConverter,
        serverEngine: serverEngine,
      );
    },
  );

  final transcribeRetryService = TranscribeRetryService(
    store: pendingTranscribeStore,
    serverEngine: serverEngine,
  );
  final localTranscribeStore = LocalTranscribeStore();
  const qualityEvaluator = AlwaysPassEvaluator();
  final localTranscribeSyncService = LocalTranscribeSyncService(
    store: localTranscribeStore,
    baseUrl: ApiConfig.baseUrl,
  );

  final connectivityMonitor = ConnectivityMonitor(
    queueService: offlineQueueService,
    transcribeRetryService: transcribeRetryService,
    localTranscribeSyncService: localTranscribeSyncService,
  );
  connectivityMonitor.startMonitoring();

  runApp(ProviderScope(
    overrides: [
      deviceIdProvider.overrideWithValue(deviceId),
      offlineQueueServiceProvider.overrideWithValue(offlineQueueService),
      pendingTranscribeStoreProvider
          .overrideWithValue(pendingTranscribeStore),
      authenticatedClientProvider.overrideWithValue(authenticatedClient),
      engineResolverProvider.overrideWithValue(engineResolver),
      localTranscribeStoreProvider.overrideWithValue(localTranscribeStore),
      qualityEvaluatorProvider.overrideWithValue(qualityEvaluator),
    ],
    child: const MyApp(),
  ));
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider);
    final transcribeMode = ref.watch(transcribeModeProvider);

    return MaterialApp(
      title: '録音アプリ',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
      ),
      home: authState.isLoading
          ? const _SplashScreen()
          : authState.isAuthenticated
              ? transcribeMode == null
                  ? const TranscribeModeSelectionPage()
                  : const HomePage()
              : const LoginPage(),
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

/// 初期化エラー時のフォールバック画面
class InitializationErrorApp extends StatelessWidget {
  final String error;

  const InitializationErrorApp({super.key, required this.error});

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
                  '起動エラー',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  'アプリの初期化中にエラーが発生しました。\n$error',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 14),
                ),
                const SizedBox(height: 16),
                const Text(
                  'アプリを再起動してください。\n問題が解決しない場合は開発者にお問い合わせください。',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
