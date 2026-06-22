package com.nergalithwayfinder

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

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
  fun getMbtilesMetadata(path: String, promise: Promise) {
    try {
      val file = File(path)
      if (!file.exists()) {
        promise.reject("MBTILES_MISSING", "MBTiles file not found.")
        return
      }

      val metadata = readMbtilesMetadata(file)
      val result = Arguments.createMap().apply {
        putString("path", file.absolutePath)
        putString("mbtilesUrl", toMbtilesUrl(file.absolutePath))
        putInt("minZoom", metadata.optInt("minzoom", 0))
        putInt("maxZoom", metadata.optInt("maxzoom", 22))
        putInt("tileSize", metadata.optInt("tileSize", 256))
        putString("name", metadata.optString("name", file.name))
        putString("attribution", metadata.optString("attribution", ""))
        if (metadata.has("centerLng")) {
          putDouble("centerLng", metadata.getDouble("centerLng"))
          putDouble("centerLat", metadata.getDouble("centerLat"))
          putDouble("centerZoom", metadata.getDouble("centerZoom"))
        }
        if (metadata.has("bounds")) {
          putArray("bounds", jsonArrayToWritable(metadata.getJSONArray("bounds")))
        }
      }
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("MBTILES_METADATA_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun getCurrentLocation(promise: Promise) {
    try {
      if (!hasLocationPermission()) {
        promise.reject("LOCATION_PERMISSION", "Location permission has not been granted.")
        return
      }

      val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
      val provider = LocationManager.GPS_PROVIDER
      if (!manager.isProviderEnabled(provider)) {
        promise.reject("GPS_DISABLED", "GPS provider is disabled on this device.")
        return
      }

      val freshLocation =
          runCatching { manager.getLastKnownLocation(provider) }.getOrNull()?.takeIf { location ->
            System.currentTimeMillis() - location.time <= LAST_KNOWN_LOCATION_MAX_AGE_MS
          }

      if (freshLocation == null) {
        requestLiveGpsFix(manager, provider, promise)
      } else {
        promise.resolve(locationToMap(freshLocation))
      }
    } catch (error: Exception) {
      promise.reject("LOCATION_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun savePin(pin: ReadableMap, promise: Promise) {
    try {
      val category = pin.getString("category") ?: return promise.reject("INVALID_PIN", "Missing category")
      val statusKey = pin.getString("status_key") ?: "unknown"
      val label = if (pin.hasKey("label") && !pin.isNull("label")) pin.getString("label") ?: "" else ""
      val latitude = pin.getDouble("latitude")
      val longitude = pin.getDouble("longitude")
      val id = pin.getString("id")?.takeIf { it.isNotBlank() } ?: UUID.randomUUID().toString()
      val now = isoNow()

      val values =
          android.content.ContentValues().apply {
            put("id", id)
            put("category", category)
            put("status_key", statusKey)
            put("label", label)
            put("latitude", latitude)
            put("longitude", longitude)
            put("created_at", now)
            put("updated_at", now)
          }
      dbHelper.writableDatabase.insertWithOnConflict(
          "pins",
          null,
          values,
          SQLiteDatabase.CONFLICT_REPLACE,
      )
      promise.resolve(
          Arguments.createMap().apply {
            putString("id", id)
            putString("category", category)
            putString("status_key", statusKey)
            putString("label", label)
            putDouble("latitude", latitude)
            putDouble("longitude", longitude)
            putString("created_at", now)
            putString("updated_at", now)
          })
    } catch (error: Exception) {
      promise.reject("PIN_SAVE_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun listPins(promise: Promise) {
    try {
      val pins = Arguments.createArray()
      dbHelper.readableDatabase
          .rawQuery("SELECT * FROM pins ORDER BY created_at DESC", null)
          .use { cursor ->
            while (cursor.moveToNext()) {
              pins.pushMap(
                  Arguments.createMap().apply {
                    putString("id", cursor.getString(cursor.getColumnIndexOrThrow("id")))
                    putString("category", cursor.getString(cursor.getColumnIndexOrThrow("category")))
                    putString("status_key", cursor.getString(cursor.getColumnIndexOrThrow("status_key")))
                    putString("label", cursor.getString(cursor.getColumnIndexOrThrow("label")))
                    putDouble("latitude", cursor.getDouble(cursor.getColumnIndexOrThrow("latitude")))
                    putDouble("longitude", cursor.getDouble(cursor.getColumnIndexOrThrow("longitude")))
                    putString("created_at", cursor.getString(cursor.getColumnIndexOrThrow("created_at")))
                    putString("updated_at", cursor.getString(cursor.getColumnIndexOrThrow("updated_at")))
                  })
            }
          }
      promise.resolve(pins)
    } catch (error: Exception) {
      promise.reject("PIN_LIST_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun deletePin(pinId: String, promise: Promise) {
    try {
      val deleted =
          dbHelper.writableDatabase.delete("pins", "id = ?", arrayOf(pinId))
      promise.resolve(deleted > 0)
    } catch (error: Exception) {
      promise.reject("PIN_DELETE_FAILED", error.message, error)
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

  private fun hasLocationPermission(): Boolean {
    return context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
  }

  private fun locationToMap(location: Location) =
      Arguments.createMap().apply {
        putDouble("latitude", location.latitude)
        putDouble("longitude", location.longitude)
        putDouble("accuracy", location.accuracy.toDouble())
        putDouble("timestamp", location.time.toDouble())
        putString("provider", location.provider ?: LocationManager.GPS_PROVIDER)
      }

  private fun requestLiveGpsFix(manager: LocationManager, provider: String, promise: Promise) {
    val handler = Handler(Looper.getMainLooper())
    var finished = false
    lateinit var listener: LocationListener
    var timeoutRunnable: Runnable? = null

    fun finish(location: Location?, errorMessage: String? = null) {
      if (finished) {
        return
      }
      finished = true
      timeoutRunnable?.let { handler.removeCallbacks(it) }
      runCatching { manager.removeUpdates(listener) }
      if (location != null) {
        promise.resolve(locationToMap(location))
      } else {
        promise.reject("LOCATION_EMPTY", errorMessage ?: "No GPS fix is available yet.")
      }
    }

    listener =
        object : LocationListener {
          override fun onLocationChanged(location: Location) {
            if (location.provider == LocationManager.GPS_PROVIDER) {
              finish(location)
            }
          }

          override fun onProviderDisabled(providerName: String) = Unit
          override fun onProviderEnabled(providerName: String) = Unit
        }

    try {
      timeoutRunnable = Runnable { finish(null, "No GPS fix was received within 12 seconds.") }
      manager.requestSingleUpdate(provider, listener, Looper.getMainLooper())
      handler.postDelayed(timeoutRunnable!!, LIVE_LOCATION_TIMEOUT_MS)
    } catch (error: SecurityException) {
      finish(null, "Location permission has not been granted.")
    } catch (error: Exception) {
      finish(null, error.message)
    }
  }

  private fun readMbtilesMetadata(file: File): JSONObject {
    val metadata = JSONObject()
    SQLiteDatabase.openDatabase(file.absolutePath, null, SQLiteDatabase.OPEN_READONLY).use { db ->
      db.rawQuery("SELECT name, value FROM metadata", null).use { cursor ->
        while (cursor.moveToNext()) {
          metadata.put(cursor.getString(0), cursor.getString(1))
        }
      }
    }

    val result = JSONObject()
    result.put("name", metadata.optString("name", file.name))
    result.put("attribution", metadata.optString("attribution", ""))
    result.put("minzoom", metadata.optString("minzoom", "0").toIntOrNull() ?: 0)
    result.put("maxzoom", metadata.optString("maxzoom", "22").toIntOrNull() ?: 22)
    result.put("tileSize", 256)

    val center = metadata.optString("center", "")
    if (center.isNotBlank()) {
      val parts = center.split(",").map { it.trim() }
      if (parts.size >= 3) {
        result.put("centerLng", parts[0].toDoubleOrNull() ?: 0.0)
        result.put("centerLat", parts[1].toDoubleOrNull() ?: 0.0)
        result.put("centerZoom", parts[2].toDoubleOrNull() ?: 12.0)
      }
    }

    val bounds = metadata.optString("bounds", "")
    if (bounds.isNotBlank()) {
      val parts = bounds.split(",").mapNotNull { it.trim().toDoubleOrNull() }
      if (parts.size == 4) {
        result.put("bounds", JSONArray(parts))
      }
    }

    return result
  }

  private fun toMbtilesUrl(path: String): String {
    val normalized = path.removePrefix("file://")
    return if (normalized.startsWith("/")) {
      "mbtiles://$normalized"
    } else {
      "mbtiles:///$normalized"
    }
  }

  private fun jsonArrayToWritable(array: JSONArray) =
      Arguments.createArray().apply {
        for (index in 0 until array.length()) {
          pushDouble(array.getDouble(index))
        }
      }

  private fun isoNow(): String {
    val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    formatter.timeZone = TimeZone.getTimeZone("UTC")
    return formatter.format(Date())
  }

  companion object {
    private const val APP_VERSION = "0.2.0"
    private const val PIN_HASH_KEY = "pin_hash_sha256"
    private const val THEME_MODE_KEY = "theme_mode"
    private const val LANGUAGE_KEY = "language"
    private const val ACTIVE_MBTILES_PATH_KEY = "active_mbtiles_path"
    private const val DEMO_MBTILES_FILENAME = "demo_bangui.mbtiles"
    private const val LAST_KNOWN_LOCATION_MAX_AGE_MS = 5 * 60 * 1_000L
    private const val LIVE_LOCATION_TIMEOUT_MS = 12_000L
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