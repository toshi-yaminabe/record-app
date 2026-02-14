import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Repository timeout configuration', () {
    test('SessionRepository has correct timeout values', () {
      final source =
          File('lib/data/repositories/session_repository.dart').readAsStringSync();

      // GET requests use 15s timeout
      expect(source, contains('timeout(const Duration(seconds: 15))'));

      // POST/PATCH requests use 30s timeout
      expect(source, contains('timeout(const Duration(seconds: 30))'));
    });

    test('BunjinRepository has correct timeout values', () {
      final source =
          File('lib/data/repositories/bunjin_repository.dart').readAsStringSync();
      expect(source, contains('timeout(const Duration(seconds: 15))'));
      expect(source, contains('timeout(const Duration(seconds: 30))'));
    });

    test('TaskRepository has correct timeout values', () {
      final source =
          File('lib/data/repositories/task_repository.dart').readAsStringSync();
      expect(source, contains('timeout(const Duration(seconds: 15))'));
      expect(source, contains('timeout(const Duration(seconds: 30))'));
    });

    test('ProposalRepository has correct timeout values', () {
      final source =
          File('lib/data/repositories/proposal_repository.dart').readAsStringSync();
      expect(source, contains('timeout(const Duration(seconds: 15))'));
      expect(source, contains('timeout(const Duration(seconds: 30))'));
    });
  });
}
