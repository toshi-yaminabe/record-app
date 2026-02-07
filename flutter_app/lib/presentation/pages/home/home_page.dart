import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/recording_provider.dart';
import 'recording_panel.dart';
import '../tasks/task_list_page.dart';
import '../daily/daily_checkin_page.dart';
import '../settings/settings_page.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  int _currentIndex = 0;

  final List<Widget> _pages = const [
    RecordingPanel(),
    TaskListPage(),
    DailyCheckinPage(),
    SettingsPage(),
  ];

  final List<String> _titles = const [
    '録音',
    'タスク',
    '日次チェックイン',
    '設定',
  ];

  @override
  Widget build(BuildContext context) {
    ref.listen<RecordingState>(recordingNotifierProvider, (previous, next) {
      if (next.error != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(next.error!)),
        );
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_currentIndex]),
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: _pages,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.mic),
            label: '録音',
          ),
          NavigationDestination(
            icon: Icon(Icons.task_alt),
            label: 'タスク',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_today),
            label: '日次',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings),
            label: '設定',
          ),
        ],
      ),
    );
  }
}
