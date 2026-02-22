import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../../../core/app_logger.dart';
import '../../../core/constants.dart';
import '../../../core/transcribe_mode.dart';
import '../../providers/auth_provider.dart';
import '../../providers/recording_provider.dart';
import '../../providers/transcribe_mode_provider.dart';
import '../../widgets/transcribe_mode_selector.dart';

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
  String _appVersion = '';

  @override
  void initState() {
    super.initState();
    _loadCounts();
    _loadVersion();
  }

  Future<void> _loadVersion() async {
    try {
      final info = await PackageInfo.fromPlatform();
      setState(() {
        _appVersion = '${info.version}+${info.buildNumber}';
      });
    } catch (e) {
      setState(() {
        _appVersion = 'unknown';
      });
    }
  }

  Future<void> _loadCounts() async {
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

  Future<void> _showDebugLog() async {
    final log = await AppLogger.readLog();
    if (!mounted) return;

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => _DebugLogPage(log: log),
      ),
    );
  }

  Future<void> _clearDebugLog() async {
    await AppLogger.clearLog();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('デバッグログをクリアしました')),
      );
    }
  }

  Future<void> _confirmSignOut() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('ログアウト'),
        content: const Text('ログアウトしますか？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('キャンセル'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('ログアウト'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await ref.read(authNotifierProvider.notifier).signOut();
    }
  }

  @override
  Widget build(BuildContext context) {
    final apiUrl = ApiConfig.baseUrl.isEmpty ? '（未設定）' : ApiConfig.baseUrl;
    final transcribeMode = ref.watch(transcribeModeProvider) ?? TranscribeMode.server;

    return ListView(
      children: [
        const SizedBox(height: 16),
        ListTile(
          leading: const Icon(Icons.info_outline),
          title: const Text('アプリバージョン'),
          subtitle: Text(_appVersion.isEmpty ? '読み込み中...' : _appVersion),
        ),
        const Divider(),

        // API接続先
        ListTile(
          leading: const Icon(Icons.link),
          title: const Text('API接続先'),
          subtitle: Text(apiUrl),
        ),
        ListTile(
          leading: const Icon(Icons.tune),
          title: const Text('文字起こし方式'),
          subtitle: Text(transcribeMode.label),
          trailing: const Icon(Icons.chevron_right),
          onTap: () async {
            final selectedMode = await showModalBottomSheet<TranscribeMode>(
              context: context,
              builder: (context) => SafeArea(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: TranscribeMode.values.map((mode) {
                    final isSelected = mode == transcribeMode;
                    return ListTile(
                      leading: Icon(
                        mode == TranscribeMode.server
                            ? Icons.cloud_outlined
                            : Icons.phone_android,
                      ),
                      title: Text(mode.label),
                      subtitle: Text(mode.description),
                      trailing: isSelected ? const Icon(Icons.check) : null,
                      onTap: () => Navigator.of(context).pop(mode),
                    );
                  }).toList(),
                ),
              ),
            );

            if (selectedMode != null) {
              await ref.read(transcribeModeProvider.notifier).setMode(selectedMode);
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('文字起こし方式を「${selectedMode.label}」に変更しました')),
              );
            }
          },
        ),
        const Divider(),

        // 文字起こし方式（FR-004/FR-005/FR-006）
        const TranscribeModeSelector(),
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
        const Divider(),

        // デバッグログ
        ListTile(
          leading: const Icon(Icons.bug_report),
          title: const Text('デバッグログ'),
          subtitle: const Text('アプリの動作ログを確認'),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _showDebugLog,
                  icon: const Icon(Icons.article),
                  label: const Text('ログ表示'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _clearDebugLog,
                  icon: const Icon(Icons.clear_all),
                  label: const Text('ログクリア'),
                ),
              ),
            ],
          ),
        ),
        const Divider(),

        // ログアウト
        ListTile(
          leading: const Icon(Icons.logout, color: Colors.red),
          title: const Text(
            'ログアウト',
            style: TextStyle(color: Colors.red),
          ),
          subtitle: const Text('アカウントからログアウトします'),
          onTap: _confirmSignOut,
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}

/// デバッグログ表示ページ
class _DebugLogPage extends StatelessWidget {
  final String log;

  const _DebugLogPage({required this.log});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('デバッグログ'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(12),
        child: SelectableText(
          log,
          style: const TextStyle(
            fontFamily: 'monospace',
            fontSize: 11,
          ),
        ),
      ),
    );
  }
}
