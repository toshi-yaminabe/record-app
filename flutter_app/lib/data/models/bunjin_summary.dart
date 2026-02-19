/// 分人サマリー（タスク・提案レスポンスに埋め込まれる軽量オブジェクト）
///
/// [BunjinModel] はユーザー所有の全フィールドを持つが、
/// このクラスは他リソースのレスポンスに含まれる 5 フィールドのみを保持する。
class BunjinSummary {
  final String id;
  final String slug;
  final String displayName;
  final String color;
  final String icon;

  const BunjinSummary({
    required this.id,
    required this.slug,
    required this.displayName,
    required this.color,
    required this.icon,
  });

  factory BunjinSummary.fromJson(Map<String, dynamic> json) {
    return BunjinSummary(
      id: json['id'] as String,
      slug: json['slug'] as String,
      displayName: json['displayName'] as String,
      color: json['color'] as String? ?? '#888888',
      icon: json['icon'] as String? ?? 'circle',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'slug': slug,
        'displayName': displayName,
        'color': color,
        'icon': icon,
      };
}
