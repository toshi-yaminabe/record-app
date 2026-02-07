/// 文人モデル
class BunjinModel {
  final String id;
  final String userId;
  final String slug;
  final String displayName;
  final String? description;
  final String color; // hex color string (e.g., "#FF5733")
  final String? icon;
  final bool isDefault;

  const BunjinModel({
    required this.id,
    required this.userId,
    required this.slug,
    required this.displayName,
    this.description,
    required this.color,
    this.icon,
    required this.isDefault,
  });

  factory BunjinModel.fromJson(Map<String, dynamic> json) {
    return BunjinModel(
      id: json['id'] as String,
      userId: json['userId'] as String,
      slug: json['slug'] as String,
      displayName: json['displayName'] as String,
      description: json['description'] as String?,
      color: json['color'] as String,
      icon: json['icon'] as String?,
      isDefault: json['isDefault'] as bool,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'slug': slug,
      'displayName': displayName,
      'description': description,
      'color': color,
      'icon': icon,
      'isDefault': isDefault,
    };
  }
}
