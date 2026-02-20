import 'package:flutter/material.dart';

/// 分人ごとの視覚署名（色 + アイコン + shortLabel）
/// Web側の bunjin-signatures.js と同一定義を維持すること
/// slug は lib/constants.js DEFAULT_BUNJINS の slug に統一
class BunjinSignature {
  final Color color;
  final IconData icon;
  final String shortLabel;

  const BunjinSignature({
    required this.color,
    required this.icon,
    required this.shortLabel,
  });
}

/// slug → BunjinSignature のマッピング
/// 色は lib/constants.js DEFAULT_BUNJINS と同一（クロスプラットフォーム一貫性）
/// 注: 実際の表示色は DB の bunjin.color を優先すること（この定義はフォールバック用）
const Map<String, BunjinSignature> kBunjinSignatures = {
  'work': BunjinSignature(
    color: Color(0xFF3B82F6), // #3b82f6: 仕事モード（青）
    icon: Icons.work_outline,
    shortLabel: '業務',
  ),
  'creative': BunjinSignature(
    color: Color(0xFF8B5CF6), // #8b5cf6: クリエイティブ（紫）
    icon: Icons.brush_outlined,
    shortLabel: '創作',
  ),
  'social': BunjinSignature(
    color: Color(0xFFEC4899), // #ec4899: ソーシャル（ピンク）
    icon: Icons.people_outline,
    shortLabel: '対人',
  ),
  'rest': BunjinSignature(
    color: Color(0xFF10B981), // #10b981: 休息（緑）
    icon: Icons.home_outlined,
    shortLabel: '回復',
  ),
  'learning': BunjinSignature(
    color: Color(0xFFF59E0B), // #f59e0b: 学習（アンバー）
    icon: Icons.star_outline,
    shortLabel: '学習',
  ),
};

/// フォールバック署名（slug が未定義の場合）
const BunjinSignature kFallbackSignature = BunjinSignature(
  color: Color(0xFF9E9E9E), // グレー
  icon: Icons.person_outline,
  shortLabel: '分人',
);

/// slug から署名を取得（デフォルトフォールバック付き）
BunjinSignature getBunjinSignature(String? slug) {
  if (slug == null) return kFallbackSignature;
  return kBunjinSignatures[slug] ?? kFallbackSignature;
}
