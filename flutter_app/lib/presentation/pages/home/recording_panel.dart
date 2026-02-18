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
    with WidgetsBindingObserver, SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.15).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pulseController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _syncState();
    }
  }

  Future<void> _syncState() async {
    final service = ref.read(recordingServiceProvider);
    final isRecording = await service.syncBackgroundState();
    final currentState = ref.read(recordingNotifierProvider);
    if (currentState.isRecording != isRecording) {
      ref.invalidate(recordingNotifierProvider);
    }
  }

  void _updatePulseAnimation({required bool isRecording}) {
    if (isRecording) {
      if (!_pulseController.isAnimating) {
        _pulseController.repeat(reverse: true);
      }
    } else {
      _pulseController.stop();
      _pulseController.reset();
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

    // アニメーション状態を録音状態に同期
    _updatePulseAnimation(isRecording: recordingState.isRecording);

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

            // 録音ボタン（パルスアニメーション付き）
            GestureDetector(
              onTap: () {
                final notifier = ref.read(recordingNotifierProvider.notifier);
                if (recordingState.isRecording) {
                  notifier.stopRecording();
                } else {
                  notifier.startRecording();
                }
              },
              child: AnimatedBuilder(
                animation: _pulseAnimation,
                builder: (context, child) {
                  final scale = recordingState.isRecording
                      ? _pulseAnimation.value
                      : 1.0;
                  final shadowSpread = recordingState.isRecording
                      ? 5.0 + (_pulseAnimation.value - 1.0) * 40
                      : 5.0;
                  final shadowOpacity = recordingState.isRecording
                      ? 0.3 + (_pulseAnimation.value - 1.0) * 1.5
                      : 0.4;

                  return Transform.scale(
                    scale: scale,
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
                                .withValues(alpha: shadowOpacity),
                            blurRadius: 20,
                            spreadRadius: shadowSpread,
                          ),
                        ],
                      ),
                      child: Icon(
                        recordingState.isRecording ? Icons.stop : Icons.mic,
                        color: Colors.white,
                        size: 48,
                      ),
                    ),
                  );
                },
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
