import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants.dart';
import '../../providers/recording_provider.dart';

/// 設定ページ
class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});

  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  int _pendingCount = 0;
  int _deadLetterCount = 0;
  bool _isLoading = false;
  bool _isRetrying = false;

  @override
  void initState() {
    super.initState();
    _loadCounts();
  }

  Future<void> _loadCounts() async {
    // H1: Riverpodプロバイダー経由で取得
    final queueService = ref.read(offlineQueueServiceProvider);
    final pending = await queueService.pendingCount();
    final deadLetter = await queueService.deadLetterCount();
    setState(() {
      _pendingCount = pending;
      _deadLetterCount = deadLetter;
    });
  }

  Future<void> _clearQueue() async {
    setState(() {
      _isLoading = true;
    });

    final queueService = ref.read(offlineQueueServiceProvider);
    await queueService.clear();
    await _loadCounts();

    setState(() {
      _isLoading = false;
    });

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('キューをクリアしました')),
      );
    }
  }

  Future<void> _retryDeadLetters() async {
    setState(() {
      _isRetrying = true;
    });

    final queueService = ref.read(offlineQueueServiceProvider);
    await queueService.retryDeadLetters();
    await _loadCounts();

    setState(() {
      _isRetrying = false;
    });

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('失敗キューを再試行キューに戻しました')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final apiUrl = ApiConfig.baseUrl.isEmpty ? '（未設定）' : ApiConfig.baseUrl;

    return ListView(
      children: [
        const SizedBox(height: 16),
        ListTile(
          leading: const Icon(Icons.info_outline),
          title: const Text('アプリバージョン'),
          subtitle: const Text('1.5.0+2'),
        ),
        const Divider(),

        // API接続先
        ListTile(
          leading: const Icon(Icons.link),
          title: const Text('API接続先'),
          subtitle: Text(apiUrl),
        ),
        const Divider(),

        // オフラインキュー
        ListTile(
          leading: const Icon(Icons.cloud_queue),
          title: const Text('オフラインキュー'),
          subtitle: Text('未送信: $_pendingCount 件'),
        ),

        // Dead letter
        ListTile(
          leading: const Icon(Icons.error_outline),
          title: const Text('送信失敗キュー'),
          subtitle: Text('失敗: $_deadLetterCount 件'),
        ),

        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _deadLetterCount == 0 || _isRetrying
                      ? null
                      : _retryDeadLetters,
                  icon: _isRetrying
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.refresh),
                  label: const Text('再試行'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _isLoading ? null : _clearQueue,
                  icon: _isLoading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.delete),
                  label: const Text('全クリア'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red,
                    foregroundColor: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}
