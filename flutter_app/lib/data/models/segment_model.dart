/// セグメントモデル
class SegmentModel {
  final String id;
  final String sessionId;
  final String userId;
  final int segmentNo;
  final DateTime startAt;
  final DateTime endAt;
  final String? text;
  final String sttStatus; // 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  final String? bunjinId;
  final DateTime createdAt;

  const SegmentModel({
    required this.id,
    required this.sessionId,
    required this.userId,
    required this.segmentNo,
    required this.startAt,
    required this.endAt,
    this.text,
    required this.sttStatus,
    this.bunjinId,
    required this.createdAt,
  });

  factory SegmentModel.fromJson(Map<String, dynamic> json) {
    return SegmentModel(
      id: json['id'] as String,
      sessionId: json['sessionId'] as String,
      userId: json['userId'] as String,
      segmentNo: json['segmentNo'] as int,
      startAt: DateTime.parse(json['startAt'] as String),
      endAt: DateTime.parse(json['endAt'] as String),
      text: json['text'] as String?,
      sttStatus: json['sttStatus'] as String,
      bunjinId: json['bunjinId'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'sessionId': sessionId,
      'userId': userId,
      'segmentNo': segmentNo,
      'startAt': startAt.toUtc().toIso8601String(),
      'endAt': endAt.toUtc().toIso8601String(),
      'text': text,
      'sttStatus': sttStatus,
      'bunjinId': bunjinId,
      'createdAt': createdAt.toUtc().toIso8601String(),
    };
  }
}
