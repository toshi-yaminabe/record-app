import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_app/core/transcribe_mode.dart';
import 'package:flutter_app/presentation/providers/transcribe_mode_provider.dart';
import 'package:flutter_app/presentation/widgets/transcribe_mode_selector.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Widget buildApp({TranscribeMode? initialMode}) {
    return ProviderScope(
      overrides: [
        if (initialMode != null)
          transcribeModeProvider
              .overrideWith((ref) => _TestModeNotifier(initialMode)),
      ],
      child: const MaterialApp(
        home: Scaffold(body: TranscribeModeSelector()),
      ),
    );
  }

  group('TranscribeModeSelector', () {
    testWidgets('FR-004: serverモード時にUI表示を確認', (tester) async {
      await tester.pumpWidget(buildApp(initialMode: TranscribeMode.server));
      await tester.pumpAndSettle();

      expect(find.text('文字起こし方式'), findsOneWidget);
      expect(find.text('WEBサーバー文字起こし'), findsOneWidget);
    });

    testWidgets('FR-005: ダイアログからmode切替が可能', (tester) async {
      await tester.pumpWidget(buildApp(initialMode: TranscribeMode.server));
      await tester.pumpAndSettle();

      // ListTileをタップしてダイアログを開く
      await tester.tap(find.text('文字起こし方式'));
      await tester.pumpAndSettle();

      // ダイアログが表示される
      expect(find.text('文字起こし方式を選択'), findsOneWidget);

      // 背景ListTile + ダイアログRadioListTileで2つ表示される
      expect(find.text('WEBサーバー文字起こし'), findsNWidgets(2));
      // ローカルモードのRadioListTileが存在する（ダイアログ内のみ）
      expect(find.text('ローカル文字起こし'), findsOneWidget);
    });

    testWidgets('FR-006: 次セグメント反映の注記が表示される', (tester) async {
      await tester.pumpWidget(buildApp(initialMode: TranscribeMode.server));
      await tester.pumpAndSettle();

      await tester.tap(find.text('文字起こし方式'));
      await tester.pumpAndSettle();

      expect(
        find.text('変更は次のセグメントから反映されます。'),
        findsOneWidget,
      );
    });

    testWidgets('ローカルモード時の注意文が表示される', (tester) async {
      await tester.pumpWidget(buildApp(initialMode: TranscribeMode.server));
      await tester.pumpAndSettle();

      await tester.tap(find.text('文字起こし方式'));
      await tester.pumpAndSettle();

      expect(
        find.textContaining('自動的にサーバー方式へフォールバック'),
        findsOneWidget,
      );
    });
  });
}

/// テスト用のTranscribeModeNotifier（SharedPreferencesをバイパス）
class _TestModeNotifier extends TranscribeModeNotifier {
  _TestModeNotifier(TranscribeMode initialMode) : super() {
    state = initialMode;
  }
}
