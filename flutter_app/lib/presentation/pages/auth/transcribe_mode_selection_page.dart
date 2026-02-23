import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/transcribe_mode.dart';
import '../../providers/transcribe_mode_provider.dart';

class TranscribeModeSelectionPage extends ConsumerStatefulWidget {
  const TranscribeModeSelectionPage({super.key});

  @override
  ConsumerState<TranscribeModeSelectionPage> createState() =>
      _TranscribeModeSelectionPageState();
}

class _TranscribeModeSelectionPageState
    extends ConsumerState<TranscribeModeSelectionPage> {
  bool _isSelecting = false;

  Future<void> _selectMode(TranscribeMode mode) async {
    if (_isSelecting) return;
    setState(() => _isSelecting = true);

    try {
      await ref.read(transcribeModeProvider.notifier).setMode(mode);
      // setModeはstateを即座に更新するのでMyAppが自動遷移する
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('モード設定に失敗しました: $e'),
            action: SnackBarAction(
              label: 'リトライ',
              onPressed: () => _selectMode(mode),
            ),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSelecting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('文字起こし方式を選択'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'ログインありがとうございます。\n最初に文字起こし方式を選んでください。',
              style: TextStyle(fontSize: 16),
            ),
            const SizedBox(height: 16),
            _ModeCard(
              mode: TranscribeMode.server,
              icon: Icons.cloud_outlined,
              enabled: !_isSelecting,
              onTap: () => _selectMode(TranscribeMode.server),
            ),
            const SizedBox(height: 12),
            _ModeCard(
              mode: TranscribeMode.local,
              icon: Icons.phone_android,
              enabled: !_isSelecting,
              onTap: () => _selectMode(TranscribeMode.local),
            ),
            const SizedBox(height: 12),
            const Text(
              '※ ローカル文字起こしは実装準備中です。現在は自動的にWEBサーバー方式へフォールバックします。',
              style: TextStyle(fontSize: 12, color: Colors.orange),
            ),
            if (_isSelecting) ...[
              const SizedBox(height: 24),
              const Center(child: CircularProgressIndicator()),
            ],
          ],
        ),
      ),
    );
  }
}

class _ModeCard extends StatelessWidget {
  final TranscribeMode mode;
  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  const _ModeCard({
    required this.mode,
    required this.icon,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Icon(icon),
        title: Text(mode.label),
        subtitle: Text(mode.description),
        trailing: const Icon(Icons.arrow_forward_ios, size: 16),
        enabled: enabled,
        onTap: enabled ? onTap : null,
      ),
    );
  }
}
