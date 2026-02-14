import '../../core/app_logger.dart';

/// オフラインキューエントリモデル
class QueueEntry {
  /// ステータス定数
  static const String statusPending = 'pending';
  static const String statusDeadLetter = 'dead_letter';

  final int? id;
  final String endpoint;
  final String method; // 'POST' | 'PATCH' | 'DELETE'
  final String payload; // JSON string
  final DateTime createdAt;
  final int retryCount;
  final String status; // statusPending | statusDeadLetter

  const QueueEntry({
    this.id,
    required this.endpoint,
    required this.method,
    required this.payload,
    required this.createdAt,
    this.retryCount = 0,
    this.status = statusPending,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'endpoint': endpoint,
      'method': method,
      'payload': payload,
      'created_at': createdAt.toUtc().toIso8601String(),
      'retry_count': retryCount,
      'status': status,
    };
  }

  factory QueueEntry.fromMap(Map<String, dynamic> map) {
    final id = map['id'] as int?;
    if (id == null) {
      AppLogger.db('QueueEntry.fromMap: id is null');
      throw StateError('QueueEntry requires non-null id from database');
    }
    return QueueEntry(
      id: id,
      endpoint: map['endpoint'] as String,
      method: map['method'] as String,
      payload: map['payload'] as String,
      createdAt: DateTime.parse(map['created_at'] as String),
      retryCount: map['retry_count'] as int,
      status: map['status'] as String,
    );
  }

  QueueEntry copyWith({
    int? id,
    String? endpoint,
    String? method,
    String? payload,
    DateTime? createdAt,
    int? retryCount,
    String? status,
  }) {
    return QueueEntry(
      id: id ?? this.id,
      endpoint: endpoint ?? this.endpoint,
      method: method ?? this.method,
      payload: payload ?? this.payload,
      createdAt: createdAt ?? this.createdAt,
      retryCount: retryCount ?? this.retryCount,
      status: status ?? this.status,
    );
  }
}
