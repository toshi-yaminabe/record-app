import 'dart:developer' as developer;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:shared_preferences/shared_preferences.dart';
import 'core/constants.dart';
import 'presentation/pages/home/home_page.dart';
import 'presentation/providers/recording_provider.dart';
import 'services/device/device_id_service.dart';
import 'services/offline/offline_queue_service.dart';
import 'services/offline/connectivity_monitor.dart';
import 'services/recording/background_service_initializer.dart';
import 'services/recording/notification_channel_setup.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // H2: baseUrlが空の場合は警告ログ出力
  if (ApiConfig.baseUrl.isEmpty) {
    developer.log(
      'WARNING: API_BASE_URL is empty. '
      'Build with --dart-define-from-file=env/prod.json to set it.',
      name: 'record-app',
    );
  }

  // deviceIdを事前解決（起動時に1回だけ）
  final deviceId = await DeviceIdService.getOrCreate();

  // recordings dirパスをSharedPreferencesにキャッシュ
  // （バックグラウンドisolateではpath_providerが使えないため）
  final docDir = await getApplicationDocumentsDirectory();
  final recordingsDir = p.join(docDir.path, 'recordings');
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString('recordings_dir', recordingsDir);

  // 通知チャネル初期化
  await NotificationChannelSetup.initialize();

  // バックグラウンドサービス初期化
  await BackgroundServiceInitializer.initialize();

  // サービス初期化
  final offlineQueueService = OfflineQueueService();
  final connectivityMonitor = ConnectivityMonitor(
    queueService: offlineQueueService,
  );
  connectivityMonitor.startMonitoring();

  runApp(ProviderScope(
    overrides: [
      deviceIdProvider.overrideWith((_) async => deviceId),
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
