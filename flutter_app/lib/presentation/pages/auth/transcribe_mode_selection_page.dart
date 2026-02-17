import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/transcribe_mode.dart';
import '../../providers/transcribe_mode_provider.dart';

class TranscribeModeSelectionPage extends ConsumerWidget {
  const TranscribeModeSelectionPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(transcribeModeProvider.notifier);

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
              onTap: () => notifier.setMode(TranscribeMode.server),
            ),
            const SizedBox(height: 12),
            _ModeCard(
              mode: TranscribeMode.local,
              icon: Icons.phone_android,
              onTap: () => notifier.setMode(TranscribeMode.local),
            ),
            const SizedBox(height: 12),
            const Text(
              '※ ローカル文字起こしは実装準備中です。現在は自動的にWEBサーバー方式へフォールバックします。',
              style: TextStyle(fontSize: 12, color: Colors.orange),
            ),
          ],
        ),
      ),
    );
  }
}

class _ModeCard extends StatelessWidget {
  final TranscribeMode mode;
  final IconData icon;
  final VoidCallback onTap;

  const _ModeCard({
    required this.mode,
    required this.icon,
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
        onTap: onTap,
      ),
    );
  }
}
