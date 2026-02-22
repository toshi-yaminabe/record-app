# Flutter plugin classes — prevent R8 stripping (Flutter issue #154580)
-keep class dev.fluttercommunity.plus.packageinfo.PackageInfoPlugin { *; }
-keep class io.flutter.plugins.GeneratedPluginRegistrant { *; }
