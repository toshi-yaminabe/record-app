import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/auth_provider.dart';
import '../../providers/recording_provider.dart';

class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final hours = twoDigits(duration.inHours);
    final minutes = twoDigits(duration.inMinutes.remainder(60));
    final seconds = twoDigits(duration.inSeconds.remainder(60));
    return '$hours:$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider);
    final recordingState = ref.watch(recordingNotifierProvider);

    ref.listen<RecordingState>(recordingNotifierProvider, (previous, next) {
      if (next.error != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(next.error!)),
        );
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('録音アプリ'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              ref.read(authNotifierProvider.notifier).signOut();
            },
          ),
        ],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'ユーザー: ${authState.user?.email ?? ""}',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 48),

            // 録音時間表示
            Text(
              _formatDuration(recordingState.elapsed),
              style: Theme.of(context).textTheme.displayLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                    fontFeatures: [const FontFeature.tabularFigures()],
                  ),
            ),
            const SizedBox(height: 8),

            // セグメント数
            if (recordingState.isRecording)
              Text(
                'セグメント: ${recordingState.segmentCount + 1}',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
            const SizedBox(height: 48),

            // 録音ボタン
            GestureDetector(
              onTap: () {
                final notifier = ref.read(recordingNotifierProvider.notifier);
                if (recordingState.isRecording) {
                  notifier.stopRecording();
                } else {
                  notifier.startRecording();
                }
              },
              child: Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: recordingState.isRecording
                      ? Colors.red
                      : Theme.of(context).colorScheme.primary,
                  boxShadow: [
                    BoxShadow(
                      color: (recordingState.isRecording
                              ? Colors.red
                              : Theme.of(context).colorScheme.primary)
                          .withValues(alpha: 0.4),
                      blurRadius: 20,
                      spreadRadius: 5,
                    ),
                  ],
                ),
                child: Icon(
                  recordingState.isRecording ? Icons.stop : Icons.mic,
                  color: Colors.white,
                  size: 48,
                ),
              ),
            ),
            const SizedBox(height: 24),

            // 状態テキスト
            Text(
              recordingState.isRecording ? '録音中...' : 'タップして録音開始',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: recordingState.isRecording
                        ? Colors.red
                        : Theme.of(context).colorScheme.onSurface,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
