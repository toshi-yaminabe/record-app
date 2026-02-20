import 'package:flutter/material.dart';
import '../../core/bunjin_signatures.dart';
import '../../data/models/bunjin_model.dart';

/// 文人チップウィジェット
class BunjinChip extends StatelessWidget {
  final BunjinModel bunjin;

  const BunjinChip({
    super.key,
    required this.bunjin,
  });

  Color _parseColor(String hexColor) {
    try {
      final hex = hexColor.replaceAll('#', '');
      return Color(int.parse('FF$hex', radix: 16));
    } catch (_) {
      return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _parseColor(bunjin.color);
    final signature = getBunjinSignature(bunjin.slug);
    final shortLabel = bunjin.description ?? signature.shortLabel;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color, width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            signature.icon,
            size: 12,
            color: color,
          ),
          const SizedBox(width: 4),
          Text(
            bunjin.displayName,
            style: TextStyle(
              fontSize: 12,
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            shortLabel,
            style: TextStyle(
              fontSize: 10,
              color: color.withValues(alpha: 0.8),
            ),
          ),
        ],
      ),
    );
  }
}
