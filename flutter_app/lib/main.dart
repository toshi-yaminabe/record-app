import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'presentation/pages/home/home_page.dart';
import 'presentation/providers/recording_provider.dart';
import 'services/device/device_id_service.dart';
import 'services/offline/offline_queue_service.dart';
import 'services/offline/connectivity_monitor.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // deviceIdを事前解決（起動時に1回だけ）
  final deviceId = await DeviceIdService.getOrCreate();

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
