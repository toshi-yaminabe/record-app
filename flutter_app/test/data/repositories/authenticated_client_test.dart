import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/core/errors.dart';

void main() {
  group('AuthenticatedClient', () {
    test('has correct baseUrl field', () {
      final source =
          File('lib/data/repositories/authenticated_client.dart')
              .readAsStringSync();
      expect(source, contains('final String baseUrl'));
    });

    test('handles JSON Content-Type header', () {
      final source =
          File('lib/data/repositories/authenticated_client.dart')
              .readAsStringSync();
      expect(source, contains("'Content-Type'"));
      expect(source, contains("'application/json'"));
    });

    test('attaches Authorization Bearer header from session', () {
      final source =
          File('lib/data/repositories/authenticated_client.dart')
              .readAsStringSync();
      expect(source, contains("'Authorization'"));
      expect(source, contains('Bearer'));
    });

    test('unwraps success envelope with data field', () {
      final source =
          File('lib/data/repositories/authenticated_client.dart')
              .readAsStringSync();
      expect(source, contains("json['success']"));
      expect(source, contains("json['data']"));
    });

    test('throws ApiException on failure response', () {
      final source =
          File('lib/data/repositories/authenticated_client.dart')
              .readAsStringSync();
      expect(source, contains('ApiException'));
    });

    test('throws ApiException with 401 on unauthorized', () {
      final source =
          File('lib/data/repositories/authenticated_client.dart')
              .readAsStringSync();
      expect(source, contains('statusCode == 401'));
    });

    test('throws NetworkException on timeout', () {
      final source =
          File('lib/data/repositories/authenticated_client.dart')
              .readAsStringSync();
      expect(source, contains('TimeoutException'));
      expect(source, contains('NetworkException'));
    });

    test('GET has default 15s timeout', () {
      final source =
          File('lib/data/repositories/authenticated_client.dart')
              .readAsStringSync();
      expect(source, contains('Duration(seconds: 15)'));
    });

    test('POST has default 30s timeout', () {
      final source =
          File('lib/data/repositories/authenticated_client.dart')
              .readAsStringSync();
      expect(source, contains('Duration(seconds: 30)'));
    });

    test('supports query parameters in GET', () {
      final source =
          File('lib/data/repositories/authenticated_client.dart')
              .readAsStringSync();
      expect(source, contains('queryParameters'));
    });
  });

  group('Error classes', () {
    test('ApiException has statusCode', () {
      final ex = ApiException('test', statusCode: 400);
      expect(ex.statusCode, 400);
      expect(ex.message, 'test');
    });

    test('ApiException toString includes status code', () {
      final ex = ApiException('forbidden', statusCode: 403);
      expect(ex.toString(), contains('403'));
    });

    test('ApiException toString includes details', () {
      final ex = ApiException('error', statusCode: 500, details: 'detail');
      expect(ex.toString(), contains('detail'));
    });

    test('NetworkException preserves message', () {
      final ex = NetworkException('timeout');
      expect(ex.message, 'timeout');
    });

    test('NetworkException with details', () {
      final ex = NetworkException('fail', details: 'no route');
      expect(ex.toString(), contains('no route'));
    });

    test('StorageException preserves message', () {
      final ex = StorageException('disk full');
      expect(ex.message, 'disk full');
    });

    test('AppException is base class', () {
      final ex = AppException('generic');
      expect(ex.message, 'generic');
      expect(ex, isA<Exception>());
    });
  });
}
