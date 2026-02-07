/// 提案モデル
class ProposalModel {
  final String id;
  final String userId;
  final String dateKey; // YYYY-MM-DD format
  final String type; // 'TASK' | 'REFLECTION' | 'GOAL'
  final String title;
  final String? body;
  final String status; // 'PENDING' | 'CONFIRMED' | 'REJECTED'
  final DateTime createdAt;

  const ProposalModel({
    required this.id,
    required this.userId,
    required this.dateKey,
    required this.type,
    required this.title,
    this.body,
    required this.status,
    required this.createdAt,
  });

  factory ProposalModel.fromJson(Map<String, dynamic> json) {
    return ProposalModel(
      id: json['id'] as String,
      userId: json['userId'] as String,
      dateKey: json['dateKey'] as String,
      type: json['type'] as String,
      title: json['title'] as String,
      body: json['body'] as String?,
      status: json['status'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'dateKey': dateKey,
      'type': type,
      'title': title,
      'body': body,
      'status': status,
      'createdAt': createdAt.toUtc().toIso8601String(),
    };
  }
}
