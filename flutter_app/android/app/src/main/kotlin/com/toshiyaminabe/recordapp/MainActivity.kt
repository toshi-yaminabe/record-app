package com.toshiyaminabe.recordapp

import android.util.Log
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.engine.plugins.FlutterPlugin

class MainActivity : FlutterActivity() {

    companion object {
        private const val TAG = "MainActivity"
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        // Do NOT call super.configureFlutterEngine() because:
        // Flutter Engine internally calls GeneratedPluginRegistrant.registerWith()
        // via reflection, and catches the InvocationTargetException that wraps
        // java.lang.Error from FFmpegKit on x86_64 emulators.
        // This means our catch(Throwable) never fires, yet all plugins after
        // FFmpegKit in the registration list remain unregistered.
        //
        // Instead, we call GeneratedPluginRegistrant.registerWith() directly
        // with catch(Throwable) so we can detect the failure and fall back to
        // individual plugin registration.
        try {
            io.flutter.plugins.GeneratedPluginRegistrant.registerWith(flutterEngine)
            Log.i(TAG, "All plugins registered successfully via GeneratedPluginRegistrant")
        } catch (t: Throwable) {
            Log.w(TAG, "GeneratedPluginRegistrant failed (${t.javaClass.simpleName}): ${t.message}")
            Log.i(TAG, "Falling back to individual plugin registration")
            registerPluginsIndividually(flutterEngine)
        }
    }

    private fun registerPluginsIndividually(flutterEngine: FlutterEngine) {
        // Register all plugins from GeneratedPluginRegistrant individually,
        // skipping any that throw (e.g. FFmpegKit on x86_64 emulators).
        // Order matches GeneratedPluginRegistrant.java for clarity.
        val pluginEntries = listOf(
            "app_links" to { com.llfbandit.app_links.AppLinksPlugin() as FlutterPlugin },
            "connectivity_plus" to { dev.fluttercommunity.plus.connectivity.ConnectivityPlugin() as FlutterPlugin },
            "ffmpeg_kit" to { com.antonkarpenko.ffmpegkit.FFmpegKitFlutterPlugin() as FlutterPlugin },
            "flutter_background_service" to { id.flutter.flutter_background_service.FlutterBackgroundServicePlugin() as FlutterPlugin },
            "flutter_local_notifications" to { com.dexterous.flutterlocalnotifications.FlutterLocalNotificationsPlugin() as FlutterPlugin },
            "flutter_secure_storage" to { com.it_nomads.fluttersecurestorage.FlutterSecureStoragePlugin() as FlutterPlugin },
            "package_info_plus" to { dev.fluttercommunity.plus.packageinfo.PackageInfoPlugin() as FlutterPlugin },
            "path_provider" to { io.flutter.plugins.pathprovider.PathProviderPlugin() as FlutterPlugin },
            "permission_handler" to { com.baseflow.permissionhandler.PermissionHandlerPlugin() as FlutterPlugin },
            "record" to { com.llfbandit.record.RecordPlugin() as FlutterPlugin },
            "shared_preferences" to { io.flutter.plugins.sharedpreferences.SharedPreferencesPlugin() as FlutterPlugin },
            "sqflite_sqlcipher" to { com.davidmartos96.sqflite_sqlcipher.SqfliteSqlCipherPlugin() as FlutterPlugin },
            "url_launcher" to { io.flutter.plugins.urllauncher.UrlLauncherPlugin() as FlutterPlugin },
        )

        var registered = 0
        var failed = 0
        for ((name, factory) in pluginEntries) {
            try {
                val plugin = factory()
                flutterEngine.plugins.add(plugin)
                Log.i(TAG, "Registered: $name")
                registered++
            } catch (t: Throwable) {
                Log.w(TAG, "Skipped $name (${t.javaClass.simpleName}): ${t.message}")
                failed++
            }
        }
        Log.i(TAG, "Individual registration complete: $registered succeeded, $failed failed")
    }
}
