/// セッションモデル
class SessionModel {
  final String id;
  final String userId;
  final String deviceId;
  final String status; // 'ACTIVE' | 'STOPPED'
  final DateTime startedAt;
  final DateTime? endedAt;
  final DateTime createdAt;

  const SessionModel({
    required this.id,
    required this.userId,
    required this.deviceId,
    required this.status,
    required this.startedAt,
    this.endedAt,
    required this.createdAt,
  });

  factory SessionModel.fromJson(Map<String, dynamic> json) {
    return SessionModel(
      id: json['id'] as String,
      userId: json['userId'] as String,
      deviceId: json['deviceId'] as String,
      status: json['status'] as String,
      startedAt: DateTime.parse(json['startedAt'] as String),
      endedAt: json['endedAt'] != null
          ? DateTime.parse(json['endedAt'] as String)
          : null,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'deviceId': deviceId,
      'status': status,
      'startedAt': startedAt.toUtc().toIso8601String(),
      'endedAt': endedAt?.toUtc().toIso8601String(),
      'createdAt': createdAt.toUtc().toIso8601String(),
    };
  }

  SessionModel copyWith({
    String? id,
    String? userId,
    String? deviceId,
    String? status,
    DateTime? startedAt,
    DateTime? endedAt,
    DateTime? createdAt,
  }) {
    return SessionModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      deviceId: deviceId ?? this.deviceId,
      status: status ?? this.status,
      startedAt: startedAt ?? this.startedAt,
      endedAt: endedAt ?? this.endedAt,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}
