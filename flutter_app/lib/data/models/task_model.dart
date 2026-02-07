/// タスクモデル
class TaskModel {
  final String id;
  final String userId;
  final String bunjinId;
  final String title;
  final String? body;
  final String status; // 'TODO' | 'DOING' | 'DONE' | 'ARCHIVED'
  final int priority;
  final DateTime? archivedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  const TaskModel({
    required this.id,
    required this.userId,
    required this.bunjinId,
    required this.title,
    this.body,
    required this.status,
    required this.priority,
    this.archivedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  /// タスクステータス遷移マトリックス（サーバーと同一）
  static const Map<String, List<String>> allowedTransitions = {
    'TODO': ['DOING', 'ARCHIVED'],
    'DOING': ['TODO', 'DONE', 'ARCHIVED'],
    'DONE': ['TODO', 'ARCHIVED'],
    'ARCHIVED': [], // 最終状態
  };

  /// ステータス遷移が許可されているかチェック
  static bool canTransition(String from, String to) {
    return allowedTransitions[from]?.contains(to) ?? false;
  }

  factory TaskModel.fromJson(Map<String, dynamic> json) {
    return TaskModel(
      id: json['id'] as String,
      userId: json['userId'] as String,
      bunjinId: json['bunjinId'] as String,
      title: json['title'] as String,
      body: json['body'] as String?,
      status: json['status'] as String,
      priority: json['priority'] as int,
      archivedAt: json['archivedAt'] != null
          ? DateTime.parse(json['archivedAt'] as String)
          : null,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'bunjinId': bunjinId,
      'title': title,
      'body': body,
      'status': status,
      'priority': priority,
      'archivedAt': archivedAt?.toUtc().toIso8601String(),
      'createdAt': createdAt.toUtc().toIso8601String(),
      'updatedAt': updatedAt.toUtc().toIso8601String(),
    };
  }

  TaskModel copyWith({
    String? id,
    String? userId,
    String? bunjinId,
    String? title,
    String? body,
    String? status,
    int? priority,
    DateTime? archivedAt,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return TaskModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      bunjinId: bunjinId ?? this.bunjinId,
      title: title ?? this.title,
      body: body ?? this.body,
      status: status ?? this.status,
      priority: priority ?? this.priority,
      archivedAt: archivedAt ?? this.archivedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
