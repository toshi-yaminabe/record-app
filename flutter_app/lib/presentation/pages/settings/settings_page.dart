import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../services/offline/offline_queue_service.dart';

/// 設定ページ
class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});

  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  int _pendingCount = 0;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadPendingCount();
  }

  Future<void> _loadPendingCount() async {
    final queueService = OfflineQueueService();
    final count = await queueService.pendingCount();
    setState(() {
      _pendingCount = count;
    });
  }

  Future<void> _clearQueue() async {
    setState(() {
      _isLoading = true;
    });

    final queueService = OfflineQueueService();
    await queueService.clear();
    await _loadPendingCount();

    setState(() {
      _isLoading = false;
    });

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('キューをクリアしました')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const SizedBox(height: 16),
        ListTile(
          leading: const Icon(Icons.info_outline),
          title: const Text('アプリバージョン'),
          subtitle: const Text('1.0.0+1'),
        ),
        const Divider(),
        ListTile(
          leading: const Icon(Icons.cloud_queue),
          title: const Text('オフラインキュー'),
          subtitle: Text('未送信: $_pendingCount 件'),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: ElevatedButton.icon(
            onPressed: _isLoading ? null : _clearQueue,
            icon: _isLoading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.delete),
            label: const Text('キューをクリア'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}
