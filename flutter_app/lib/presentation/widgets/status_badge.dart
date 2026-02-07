import 'package:flutter/material.dart';

/// ステータスバッジウィジェット
class StatusBadge extends StatelessWidget {
  final String status;

  const StatusBadge({
    super.key,
    required this.status,
  });

  Color _getStatusColor() {
    switch (status) {
      case 'TODO':
        return Colors.blue;
      case 'DOING':
        return Colors.orange;
      case 'DONE':
        return Colors.green;
      case 'ARCHIVED':
        return Colors.grey;
      default:
        return Colors.grey;
    }
  }

  String _getStatusLabel() {
    switch (status) {
      case 'TODO':
        return '未着手';
      case 'DOING':
        return '進行中';
      case 'DONE':
        return '完了';
      case 'ARCHIVED':
        return 'アーカイブ';
      default:
        return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _getStatusColor();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color, width: 1),
      ),
      child: Text(
        _getStatusLabel(),
        style: TextStyle(
          fontSize: 11,
          color: color,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
