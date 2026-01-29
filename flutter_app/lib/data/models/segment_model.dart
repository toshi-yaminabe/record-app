/// セグメントモデル
class SegmentModel {
  final String id;
  final String sessionId;
  final String userId;
  final String localPath;
  final String? storagePath;
  final DateTime startTime;
  final DateTime endTime;
  final String splitReason;
  final SegmentStatus status;
  final String? text;
  final DateTime createdAt;

  SegmentModel({
    required this.id,
    required this.sessionId,
    required this.userId,
    required this.localPath,
    this.storagePath,
    required this.startTime,
    required this.endTime,
    required this.splitReason,
    required this.status,
    this.text,
    required this.createdAt,
  });

  SegmentModel copyWith({
    String? id,
    String? sessionId,
    String? userId,
    String? localPath,
    String? storagePath,
    DateTime? startTime,
    DateTime? endTime,
    String? splitReason,
    SegmentStatus? status,
    String? text,
    DateTime? createdAt,
  }) {
    return SegmentModel(
      id: id ?? this.id,
      sessionId: sessionId ?? this.sessionId,
      userId: userId ?? this.userId,
      localPath: localPath ?? this.localPath,
      storagePath: storagePath ?? this.storagePath,
      startTime: startTime ?? this.startTime,
      endTime: endTime ?? this.endTime,
      splitReason: splitReason ?? this.splitReason,
      status: status ?? this.status,
      text: text ?? this.text,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'session_id': sessionId,
      'user_id': userId,
      'local_path': localPath,
      'storage_path': storagePath,
      'start_at': startTime.toIso8601String(),
      'end_at': endTime.toIso8601String(),
      'split_reason': splitReason,
      'stt_status': status.name,
      'text': text,
      'created_at': createdAt.toIso8601String(),
    };
  }

  factory SegmentModel.fromJson(Map<String, dynamic> json) {
    return SegmentModel(
      id: json['id'] as String,
      sessionId: json['session_id'] as String,
      userId: json['user_id'] as String,
      localPath: json['local_path'] as String,
      storagePath: json['storage_path'] as String?,
      startTime: DateTime.parse(json['start_at'] as String),
      endTime: DateTime.parse(json['end_at'] as String),
      splitReason: json['split_reason'] as String,
      status: SegmentStatus.values.firstWhere(
        (e) => e.name == json['stt_status'],
        orElse: () => SegmentStatus.pending,
      ),
      text: json['text'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}

enum SegmentStatus {
  pending,    // アップロード待ち
  uploading,  // アップロード中
  uploaded,   // アップロード完了
  processing, // STT処理中
  succeeded,  // STT完了
  failed,     // 失敗
}
