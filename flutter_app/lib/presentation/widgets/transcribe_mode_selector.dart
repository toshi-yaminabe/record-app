import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/transcribe_mode.dart';
import '../providers/transcribe_mode_provider.dart';

/// Settings画面用のモード切替ウィジェット（FR-004/FR-005/FR-006）
class TranscribeModeSelector extends ConsumerWidget {
  const TranscribeModeSelector({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentMode = ref.watch(transcribeModeProvider);
    final displayMode = currentMode ?? TranscribeMode.server;

    return ListTile(
      leading: Icon(displayMode.icon),
      title: const Text('文字起こし方式'),
      subtitle: Text(displayMode.label),
      trailing: const Icon(Icons.arrow_forward_ios, size: 16),
      onTap: () => _showModeDialog(context, ref, displayMode),
    );
  }

  void _showModeDialog(
    BuildContext context,
    WidgetRef ref,
    TranscribeMode currentMode,
  ) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return _ModeSelectionDialog(
          currentMode: currentMode,
          onModeSelected: (mode) {
            ref.read(transcribeModeProvider.notifier).setMode(mode);
            Navigator.of(dialogContext).pop();
          },
        );
      },
    );
  }
}

class _ModeSelectionDialog extends StatelessWidget {
  final TranscribeMode currentMode;
  final ValueChanged<TranscribeMode> onModeSelected;

  const _ModeSelectionDialog({
    required this.currentMode,
    required this.onModeSelected,
  });

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('文字起こし方式を選択'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final mode in TranscribeMode.values)
            RadioListTile<TranscribeMode>(
              value: mode,
              groupValue: currentMode,
              title: Row(
                children: [
                  Icon(mode.icon, size: 20),
                  const SizedBox(width: 8),
                  Expanded(child: Text(mode.label)),
                ],
              ),
              subtitle: Text(mode.description),
              onChanged: (value) {
                if (value != null) onModeSelected(value);
              },
            ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.blue.shade50,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Text(
              '変更は次のセグメントから反映されます。',
              style: TextStyle(fontSize: 12, color: Colors.blue),
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.orange.shade50,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Text(
              'ローカル文字起こしは開発中です。'
              '自動的にサーバー方式へフォールバックします。',
              style: TextStyle(fontSize: 12, color: Colors.orange),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('閉じる'),
        ),
      ],
    );
  }
}
