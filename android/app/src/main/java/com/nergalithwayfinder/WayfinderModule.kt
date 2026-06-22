package com.nergalithwayfinder

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.Locale

class WayfinderModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

  private val dbHelper = WayfinderDatabase(context)

  override fun getName(): String = "WayfinderNative"

  @ReactMethod
  fun initialize(promise: Promise) {
    try {
      dbHelper.writableDatabase
      ensureDirectories()
      val demoPath = ensureDemoTilesInstalled()
      val activePath = settingsPrefs().getString(ACTIVE_MBTILES_PATH_KEY, null)
      if (activePath.isNullOrBlank() && demoPath != null) {
        settingsPrefs().edit().putString(ACTIVE_MBTILES_PATH_KEY, demoPath).apply()
      }
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("INIT_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun getAppVersion(promise: Promise) {
    promise.resolve(APP_VERSION)
  }

  @ReactMethod
  fun isPinConfigured(promise: Promise) {
    try {
      promise.resolve(pinPrefs().contains(PIN_HASH_KEY))
    } catch (error: Exception) {
      promise.reject("PIN_CHECK_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun setPin(pin: String, promise: Promise) {
    try {
      if (!pin.matches(Regex("\\d{4}"))) {
        promise.reject("PIN_INVALID", "PIN must be exactly 4 digits.")
        return
      }
      pinPrefs().edit().putString(PIN_HASH_KEY, sha256(pin)).apply()
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("PIN_SAVE_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun verifyPin(pin: String, promise: Promise) {
    try {
      val stored = pinPrefs().getString(PIN_HASH_KEY, null)
      promise.resolve(stored != null && stored == sha256(pin))
    } catch (error: Exception) {
      promise.reject("PIN_VERIFY_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun clearPin(promise: Promise) {
    try {
      pinPrefs().edit().remove(PIN_HASH_KEY).apply()
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("PIN_CLEAR_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun getThemeMode(promise: Promise) {
    try {
      promise.resolve(settingsPrefs().getString(THEME_MODE_KEY, "dark"))
    } catch (error: Exception) {
      promise.reject("THEME_LOAD_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun setThemeMode(mode: String, promise: Promise) {
    try {
      val normalized = mode.trim().lowercase(Locale.US)
      if (normalized != "dark" && normalized != "light") {
        promise.reject("THEME_INVALID", "Theme must be dark or light.")
        return
      }
      settingsPrefs().edit().putString(THEME_MODE_KEY, normalized).apply()
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("THEME_SAVE_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun getLanguage(promise: Promise) {
    try {
      promise.resolve(settingsPrefs().getString(LANGUAGE_KEY, "fr"))
    } catch (error: Exception) {
      promise.reject("LANGUAGE_LOAD_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun setLanguage(language: String, promise: Promise) {
    try {
      val normalized = language.trim().lowercase(Locale.US)
      if (normalized != "fr" && normalized != "en") {
        promise.reject("LANGUAGE_INVALID", "Language must be fr or en.")
        return
      }
      settingsPrefs().edit().putString(LANGUAGE_KEY, normalized).apply()
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("LANGUAGE_SAVE_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun getActiveMbtilesPath(promise: Promise) {
    try {
      promise.resolve(settingsPrefs().getString(ACTIVE_MBTILES_PATH_KEY, null))
    } catch (error: Exception) {
      promise.reject("MBTILES_PATH_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun listTilePackages(promise: Promise) {
    try {
      val packages = Arguments.createArray()
      val demoFile = File(tilesDirectory(), DEMO_MBTILES_FILENAME)
      if (demoFile.exists()) {
        packages.pushMap(
            tilePackageMap(
                id = "demo_bangui",
                name = "Demo Bangui (CAR)",
                path = demoFile.absolutePath,
                isDemo = true,
            ))
      }

      val sideloadDir = sideloadTilesDirectory()
      sideloadDir
          .listFiles { file -> file.isFile && file.name.endsWith(".mbtiles", ignoreCase = true) }
          ?.sortedBy { it.name.lowercase(Locale.US) }
          ?.forEach { file ->
            packages.pushMap(
                tilePackageMap(
                    id = file.nameWithoutExtension,
                    name = file.nameWithoutExtension,
                    path = file.absolutePath,
                    isDemo = false,
                ))
          }

      promise.resolve(packages)
    } catch (error: Exception) {
      promise.reject("MBTILES_LIST_FAILED", error.message, error)
    }
  }

  private fun tilePackageMap(id: String, name: String, path: String, isDemo: Boolean) =
      Arguments.createMap().apply {
        putString("id", id)
        putString("name", name)
        putString("path", path)
        putBoolean("isDemo", isDemo)
      }

  private fun ensureDirectories() {
    tilesDirectory().mkdirs()
    sideloadTilesDirectory().mkdirs()
    File(context.filesDir, "exports").mkdirs()
  }

  private fun ensureDemoTilesInstalled(): String? {
    val target = File(tilesDirectory(), DEMO_MBTILES_FILENAME)
    if (target.exists() && target.length() > 0) {
      return target.absolutePath
    }

    return try {
      context.assets.open("tiles/$DEMO_MBTILES_FILENAME").use { input ->
        FileOutputStream(target).use { output -> input.copyTo(output) }
      }
      target.absolutePath
    } catch (_: Exception) {
      null
    }
  }

  private fun tilesDirectory(): File = File(context.filesDir, "tiles")

  private fun sideloadTilesDirectory(): File = File(tilesDirectory(), "sideload")

  private fun pinPrefs() = context.getSharedPreferences("wayfinder_security", Context.MODE_PRIVATE)

  private fun settingsPrefs() = context.getSharedPreferences("wayfinder_settings", Context.MODE_PRIVATE)

  private fun sha256(value: String): String {
    val bytes = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
    return bytes.joinToString("") { "%02x".format(it) }
  }

  companion object {
    private const val APP_VERSION = "0.1.0"
    private const val PIN_HASH_KEY = "pin_hash_sha256"
    private const val THEME_MODE_KEY = "theme_mode"
    private const val LANGUAGE_KEY = "language"
    private const val ACTIVE_MBTILES_PATH_KEY = "active_mbtiles_path"
    private const val DEMO_MBTILES_FILENAME = "demo_bangui.mbtiles"
  }
}

private class WayfinderDatabase(context: ReactApplicationContext) :
    SQLiteOpenHelper(context, "nergalith_wayfinder.db", null, 1) {
  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL(
        """
        CREATE TABLE pins (
          id TEXT PRIMARY KEY NOT NULL,
          category TEXT NOT NULL,
          status_key TEXT NOT NULL,
          label TEXT NOT NULL DEFAULT '',
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
        """.trimIndent())
    db.execSQL(
        """
        CREATE TABLE routes (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL DEFAULT '',
          pin_ids_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
        """.trimIndent())
    db.execSQL(
        """
        CREATE TABLE track_points (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          recorded_at TEXT NOT NULL
        )
        """.trimIndent())
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    // Phase 1 schema only.
  }
}