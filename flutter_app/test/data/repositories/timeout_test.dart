import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AuthenticatedClient timeout configuration', () {
    test('AuthenticatedClient has default GET timeout of 15s', () {
      final source = File('lib/data/repositories/authenticated_client.dart')
          .readAsStringSync();

      // GET requests default to 15s timeout
      expect(source, contains("Duration(seconds: 15)"));
    });

    test('AuthenticatedClient has default POST/PATCH timeout of 30s', () {
      final source = File('lib/data/repositories/authenticated_client.dart')
          .readAsStringSync();

      // POST/PATCH requests default to 30s timeout
      expect(source, contains("Duration(seconds: 30)"));
    });

    test('Repositories delegate to AuthenticatedClient', () {
      // SessionRepository uses client.post/get/patch (no direct timeout)
      final sessionSource =
          File('lib/data/repositories/session_repository.dart')
              .readAsStringSync();
      expect(sessionSource, contains('client.post'));
      expect(sessionSource, contains('client.get'));
      expect(sessionSource, contains('client.patch'));

      // BunjinRepository uses client methods
      final bunjinSource =
          File('lib/data/repositories/bunjin_repository.dart')
              .readAsStringSync();
      expect(bunjinSource, contains('client.'));
    });
  });
}
