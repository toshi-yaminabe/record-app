/// アプリ例外基底クラス
class AppException implements Exception {
  final String message;
  final String? details;
  final StackTrace? stackTrace;

  AppException(
    this.message, {
    this.details,
    this.stackTrace,
  });

  @override
  String toString() {
    if (details != null) {
      return '$message: $details';
    }
    return message;
  }
}

/// ネットワーク例外
class NetworkException extends AppException {
  NetworkException(
    super.message, {
    super.details,
    super.stackTrace,
  });
}

/// API例外
class ApiException extends AppException {
  final int? statusCode;

  ApiException(
    super.message, {
    this.statusCode,
    super.details,
    super.stackTrace,
  });

  @override
  String toString() {
    if (statusCode != null) {
      return 'API Error ($statusCode): $message${details != null ? ': $details' : ''}';
    }
    return super.toString();
  }
}

/// ストレージ例外
class StorageException extends AppException {
  StorageException(
    super.message, {
    super.details,
    super.stackTrace,
  });
}
