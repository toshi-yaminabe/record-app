import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/recording_provider.dart';

/// 録音パネルウィジェット
class RecordingPanel extends ConsumerStatefulWidget {
  const RecordingPanel({super.key});

  @override
  ConsumerState<RecordingPanel> createState() => _RecordingPanelState();
}

class _RecordingPanelState extends ConsumerState<RecordingPanel>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // C3: フォアグラウンド復帰時にバックグラウンドサービスと状態同期
      _syncState();
    }
  }

  Future<void> _syncState() async {
    final service = ref.read(recordingServiceProvider);
    final isRecording = await service.syncBackgroundState();
    // Notifierの状態をバックグラウンドの実態に合わせる
    final currentState = ref.read(recordingNotifierProvider);
    if (currentState.isRecording != isRecording) {
      // 状態不一致の場合はリロード（UI再構築のトリガー）
      ref.invalidate(recordingNotifierProvider);
    }
  }

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final hours = twoDigits(duration.inHours);
    final minutes = twoDigits(duration.inMinutes.remainder(60));
    final seconds = twoDigits(duration.inSeconds.remainder(60));
    return '$hours:$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    final recordingState = ref.watch(recordingNotifierProvider);

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
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

            // セグメント・文字起こし状態
            if (recordingState.isRecording || recordingState.segmentCount > 0)
              Text(
                'セグメント: ${recordingState.segmentCount}  |  '
                '文字起こし: ${recordingState.transcribedCount}',
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

            // 最新の文字起こし結果
            if (recordingState.lastTranscript != null) ...[
              const SizedBox(height: 32),
              const Divider(),
              const SizedBox(height: 16),
              Text(
                '最新の文字起こし:',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  recordingState.lastTranscript!,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
