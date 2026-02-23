# Flutter plugin classes — prevent R8 stripping (Flutter issue #154580)
# Flutter SDK's flutter_proguard_rules.pro keeps FlutterPlugin implementations
# with allowshrinking, which can strip Pigeon-generated methods.
# These rules provide full protection for all plugins used by this app.

# --- Plugin registration ---
-keep class io.flutter.plugins.GeneratedPluginRegistrant { *; }

# --- Pigeon-based plugins (all classes including Kotlin-generated Async variants) ---
-keep class io.flutter.plugins.pathprovider.** { *; }
-keep class io.flutter.plugins.sharedpreferences.** { *; }

# --- MethodChannel-based plugins ---
-keep class dev.fluttercommunity.plus.packageinfo.PackageInfoPlugin { *; }

# --- Catch-all for Pigeon-generated inner classes (Java & Kotlin) ---
-keep class **.Messages { *; }
-keep class **.Messages$* { *; }
-keep class **.*PigeonCodec { *; }
-keep class **.*PigeonUtils { *; }

# --- Play Core missing classes (deferred components, not used by this app) ---
-dontwarn com.google.android.play.core.splitcompat.SplitCompatApplication
-dontwarn com.google.android.play.core.splitinstall.**
-dontwarn com.google.android.play.core.tasks.**
