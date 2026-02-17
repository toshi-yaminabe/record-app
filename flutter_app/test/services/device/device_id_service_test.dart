import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_app/services/device/device_id_service.dart';

void main() {
  group('DeviceIdService', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test('generates new UUID when no existing id', () async {
      final id = await DeviceIdService.getOrCreate();
      expect(id, isNotEmpty);
      // UUID v4 format: 8-4-4-4-12
      expect(
        RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
            .hasMatch(id),
        isTrue,
      );
    });

    test('returns existing id on second call', () async {
      final first = await DeviceIdService.getOrCreate();
      final second = await DeviceIdService.getOrCreate();
      expect(first, second);
    });

    test('returns stored id from SharedPreferences', () async {
      SharedPreferences.setMockInitialValues({'device_id': 'existing-id-123'});
      final id = await DeviceIdService.getOrCreate();
      expect(id, 'existing-id-123');
    });
  });
}
