package com.nergalithwayfinder

import android.Manifest
import android.app.Activity
import android.content.ContentResolver
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.provider.OpenableColumns
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ActivityEventListener
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
  private val sensorManager =
      context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
  private var compassListener: SensorEventListener? = null
  private var compassActive = false
  private var lastHeading: Float? = null
  private var importMbtilesPromise: Promise? = null
  private val activityEventListener: ActivityEventListener =
      object : BaseActivityEventListener() {
        override fun onActivityResult(
            activity: Activity,
            requestCode: Int,
            resultCode: Int,
            data: Intent?,
        ) {
          if (requestCode != IMPORT_MBTILES_REQUEST_CODE) {
            return
          }

          val promise = importMbtilesPromise ?: return
          importMbtilesPromise = null

          if (resultCode != Activity.RESULT_OK) {
            promise.reject("MBTILES_IMPORT_CANCELLED", "MBTiles import was cancelled.")
            return
          }

          val uri = data?.data
          if (uri == null) {
            promise.reject("MBTILES_IMPORT_EMPTY", "No MBTiles file was selected.")
            return
          }

          try {
            val copied = copyMbtilesUriToSideload(uri)
            promise.resolve(
                tilePackageMap(
                    id = copied.nameWithoutExtension,
                    name = copied.nameWithoutExtension,
                    path = copied.absolutePath,
                    isDemo = false,
                ))
          } catch (error: Exception) {
            promise.reject("MBTILES_IMPORT_FAILED", error.message, error)
          }
        }
      }

  init {
    context.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = "WayfinderNative"

  @ReactMethod
  fun initialize(promise: Promise) {
    try {
      dbHelper.writableDatabase
      ensureDirectories()
      ensureDeviceId()
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
  fun getDeviceId(promise: Promise) {
    try {
      promise.resolve(ensureDeviceId())
    } catch (error: Exception) {
      promise.reject("DEVICE_ID_FAILED", error.message, error)
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
      promise.resolve(settingsPrefs().getString(LANGUAGE_KEY, "en"))
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
  fun setActiveMbtilesPath(path: String, promise: Promise) {
    try {
      val file = File(path)
      if (!file.exists() || !file.isFile) {
        promise.reject("MBTILES_MISSING", "MBTiles file not found.")
        return
      }
      if (!file.name.endsWith(".mbtiles", ignoreCase = true)) {
        promise.reject("MBTILES_INVALID", "Active tile package must be an .mbtiles file.")
        return
      }
      settingsPrefs().edit().putString(ACTIVE_MBTILES_PATH_KEY, file.absolutePath).apply()
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("MBTILES_SET_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun importMbtilesPackage(promise: Promise) {
    if (importMbtilesPromise != null) {
      promise.reject("MBTILES_IMPORT_BUSY", "Another MBTiles import is already in progress.")
      return
    }

    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("MBTILES_IMPORT_UNAVAILABLE", "No Android activity is available.")
      return
    }

    importMbtilesPromise = promise
    val intent =
        Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
          addCategory(Intent.CATEGORY_OPENABLE)
          type = "application/octet-stream"
          putExtra(Intent.EXTRA_TITLE, "*.mbtiles")
        }

    try {
      activity.startActivityForResult(intent, IMPORT_MBTILES_REQUEST_CODE)
    } catch (error: Exception) {
      importMbtilesPromise = null
      promise.reject("MBTILES_IMPORT_LAUNCH_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun getSideloadTilesPath(promise: Promise) {
    try {
      promise.resolve(sideloadTilesDirectory().absolutePath)
    } catch (error: Exception) {
      promise.reject("MBTILES_SIDELOAD_PATH_FAILED", error.message, error)
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
  fun startCompass(promise: Promise) {
    try {
      if (compassActive) {
        promise.resolve(true)
        return
      }

      val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
      if (sensor == null) {
        promise.reject("COMPASS_UNAVAILABLE", "Device has no rotation vector sensor.")
        return
      }

      compassListener =
          object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) {
              val rotationMatrix = FloatArray(9)
              val orientationAngles = FloatArray(3)
              SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
              SensorManager.getOrientation(rotationMatrix, orientationAngles)
              var azimuth = Math.toDegrees(orientationAngles[0].toDouble()).toFloat()
              if (azimuth < 0) {
                azimuth += 360f
              }
              lastHeading = azimuth
            }

            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
          }

      sensorManager.registerListener(
          compassListener,
          sensor,
          SensorManager.SENSOR_DELAY_UI,
      )
      compassActive = true
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("COMPASS_START_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun stopCompass(promise: Promise) {
    try {
      compassListener?.let { sensorManager.unregisterListener(it) }
      compassListener = null
      compassActive = false
      lastHeading = null
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("COMPASS_STOP_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun getCompassHeading(promise: Promise) {
    try {
      val heading = lastHeading
      if (heading == null) {
        promise.reject("COMPASS_EMPTY", "Compass heading is not available yet.")
        return
      }
      promise.resolve(
          Arguments.createMap().apply {
            putDouble("heading", heading.toDouble())
            putString("cardinal", cardinalFromDegrees(heading))
          })
    } catch (error: Exception) {
      promise.reject("COMPASS_READ_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun appendTrackPoint(latitude: Double, longitude: Double, promise: Promise) {
    try {
      val now = isoNow()
      val id =
          dbHelper.writableDatabase.insert(
              "track_points",
              null,
              android.content.ContentValues().apply {
                put("latitude", latitude)
                put("longitude", longitude)
                put("recorded_at", now)
              },
          )
      promise.resolve(
          Arguments.createMap().apply {
            putDouble("id", id.toDouble())
            putDouble("latitude", latitude)
            putDouble("longitude", longitude)
            putString("recorded_at", now)
          })
    } catch (error: Exception) {
      promise.reject("TRACK_APPEND_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun listTrackPoints(promise: Promise) {
    try {
      val points = Arguments.createArray()
      dbHelper.readableDatabase
          .rawQuery("SELECT * FROM track_points ORDER BY id ASC", null)
          .use { cursor ->
            while (cursor.moveToNext()) {
              points.pushMap(
                  Arguments.createMap().apply {
                    putDouble("id", cursor.getDouble(cursor.getColumnIndexOrThrow("id")))
                    putDouble("latitude", cursor.getDouble(cursor.getColumnIndexOrThrow("latitude")))
                    putDouble(
                        "longitude", cursor.getDouble(cursor.getColumnIndexOrThrow("longitude")))
                    putString(
                        "recorded_at", cursor.getString(cursor.getColumnIndexOrThrow("recorded_at")))
                  })
            }
          }
      promise.resolve(points)
    } catch (error: Exception) {
      promise.reject("TRACK_LIST_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun clearTrackPoints(promise: Promise) {
    try {
      dbHelper.writableDatabase.delete("track_points", null, null)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("TRACK_CLEAR_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun appendPinToRoute(pinId: String, promise: Promise) {
    try {
      val route = loadActiveRoute()
      val pinIds = route.pinIds.toMutableList()
      if (pinIds.isEmpty() || pinIds.last() != pinId) {
        pinIds.add(pinId)
      }
      val saved = persistActiveRoute(route.name, pinIds)
      promise.resolve(saved)
    } catch (error: Exception) {
      promise.reject("ROUTE_APPEND_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun getActiveRoute(promise: Promise) {
    try {
      promise.resolve(loadActiveRoute().toMap())
    } catch (error: Exception) {
      promise.reject("ROUTE_LOAD_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun clearRoute(promise: Promise) {
    try {
      dbHelper.writableDatabase.delete("routes", "id = ?", arrayOf(ACTIVE_ROUTE_ID))
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("ROUTE_CLEAR_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun exportAar(promise: Promise) {
    try {
      val exportId = "WF-${exportStamp()}"
      val payload = buildAarPayload(exportId)
      val jsonFilename = "$exportId.json"
      val kmlFilename = "$exportId.kml"
      val jsonResult = writePublicExportFile(jsonFilename, "application/json", payload.toString(2))
      val kmlResult = writePublicExportFile(kmlFilename, "application/vnd.google-earth.kml+xml", buildKml(payload))
      promise.resolve(
          Arguments.createMap().apply {
            putString("exportId", exportId)
            putString("jsonFilename", jsonFilename)
            putString("kmlFilename", kmlFilename)
            putString("jsonPath", jsonResult.getString("path"))
            putString("kmlPath", kmlResult.getString("path"))
            putString("jsonUri", jsonResult.getString("uri"))
            putString("kmlUri", kmlResult.getString("uri"))
            putInt("pinCount", payload.getJSONArray("pins").length())
            putInt("trackPointCount", payload.getJSONArray("track_points").length())
          })
    } catch (error: Exception) {
      promise.reject("EXPORT_FAILED", error.message, error)
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

  private fun copyMbtilesUriToSideload(uri: Uri): File {
    val originalName = displayNameForUri(uri) ?: "tiles-${System.currentTimeMillis()}.mbtiles"
    if (!originalName.endsWith(".mbtiles", ignoreCase = true)) {
      throw IllegalArgumentException("Selected file must have a .mbtiles extension.")
    }

    val safeName = originalName.replace(Regex("[^A-Za-z0-9._-]"), "_")
    val targetDir = sideloadTilesDirectory().apply { mkdirs() }
    var target = File(targetDir, safeName)
    if (target.exists()) {
      val base = target.nameWithoutExtension
      val extension = target.extension
      target = File(targetDir, "$base-${System.currentTimeMillis()}.$extension")
    }

    context.contentResolver.openInputStream(uri).use { input ->
      if (input == null) {
        throw IllegalStateException("Unable to read selected MBTiles file.")
      }
      FileOutputStream(target).use { output -> input.copyTo(output) }
    }

    if (target.length() <= 0) {
      target.delete()
      throw IllegalStateException("Selected MBTiles file was empty.")
    }

    try {
      readMbtilesMetadata(target)
    } catch (error: Exception) {
      target.delete()
      throw error
    }
    return target
  }

  private fun displayNameForUri(uri: Uri): String? {
    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
        ?.use { cursor ->
          if (cursor.moveToFirst()) {
            val column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (column >= 0) {
              return cursor.getString(column)
            }
          }
        }
    return uri.lastPathSegment?.substringAfterLast('/')
  }

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

  private fun exportStamp(): String {
    val formatter = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US)
    formatter.timeZone = TimeZone.getTimeZone("UTC")
    return formatter.format(Date())
  }

  private fun ensureDeviceId(): String {
    val prefs = settingsPrefs()
    val existing = prefs.getString(DEVICE_ID_KEY, null)
    if (!existing.isNullOrBlank()) {
      return existing
    }
    val generated = UUID.randomUUID().toString()
    prefs.edit().putString(DEVICE_ID_KEY, generated).apply()
    return generated
  }

  /** Mirrors STATUS_COLORS hex values in src/constants/symbology.js */
  private fun statusColorHex(statusKey: String): String =
      when (statusKey) {
        "hostile" -> "#dc2626"
        "friendly" -> "#16a34a"
        "unknown" -> "#eab308"
        "neutral" -> "#2563eb"
        "inactive" -> "#64748b"
        else -> "#eab308"
      }

  private fun cardinalFromDegrees(degrees: Float): String {
    val normalized = ((degrees % 360f) + 360f) % 360f
    val cards = arrayOf("N", "NE", "E", "SE", "S", "SW", "W", "NW")
    val index = ((normalized + 22.5f) / 45f).toInt() % 8
    return cards[index]
  }

  private data class ActiveRoute(
      val id: String,
      val name: String,
      val pinIds: List<String>,
      val createdAt: String,
  ) {
    fun toMap() =
        Arguments.createMap().apply {
          putString("id", id)
          putString("name", name)
          putArray("pin_ids", Arguments.createArray().apply { pinIds.forEach { pushString(it) } })
          putString("created_at", createdAt)
        }
  }

  private fun loadActiveRoute(): ActiveRoute {
    dbHelper.readableDatabase
        .rawQuery("SELECT * FROM routes WHERE id = ? LIMIT 1", arrayOf(ACTIVE_ROUTE_ID))
        .use { cursor ->
          if (cursor.moveToFirst()) {
            val pinIdsJson = cursor.getString(cursor.getColumnIndexOrThrow("pin_ids_json"))
            val pinIds =
                JSONArray(pinIdsJson).let { array ->
                  buildList {
                    for (index in 0 until array.length()) {
                      add(array.optString(index))
                    }
                  }
                }
            return ActiveRoute(
                id = ACTIVE_ROUTE_ID,
                name = cursor.getString(cursor.getColumnIndexOrThrow("name")),
                pinIds = pinIds,
                createdAt = cursor.getString(cursor.getColumnIndexOrThrow("created_at")),
            )
          }
        }
    return ActiveRoute(ACTIVE_ROUTE_ID, "", emptyList(), "")
  }

  private fun persistActiveRoute(name: String, pinIds: List<String>): com.facebook.react.bridge.WritableMap {
    val now = isoNow()
    val values =
        android.content.ContentValues().apply {
          put("id", ACTIVE_ROUTE_ID)
          put("name", name)
          put("pin_ids_json", JSONArray(pinIds).toString())
          put("created_at", now)
        }
    dbHelper.writableDatabase.insertWithOnConflict(
        "routes",
        null,
        values,
        SQLiteDatabase.CONFLICT_REPLACE,
    )
    return ActiveRoute(ACTIVE_ROUTE_ID, name, pinIds, now).toMap()
  }

  private fun buildAarPayload(exportId: String): JSONObject {
    val pins = JSONArray()
    dbHelper.readableDatabase
        .rawQuery("SELECT * FROM pins ORDER BY created_at ASC", null)
        .use { cursor ->
          while (cursor.moveToNext()) {
            pins.put(
                JSONObject().apply {
                  put("id", cursor.getString(cursor.getColumnIndexOrThrow("id")))
                  put("category", cursor.getString(cursor.getColumnIndexOrThrow("category")))
                  val statusKey = cursor.getString(cursor.getColumnIndexOrThrow("status_key"))
                  put("status_key", statusKey)
                  put("status_color", statusColorHex(statusKey))
                  put("label", cursor.getString(cursor.getColumnIndexOrThrow("label")))
                  put("latitude", cursor.getDouble(cursor.getColumnIndexOrThrow("latitude")))
                  put("longitude", cursor.getDouble(cursor.getColumnIndexOrThrow("longitude")))
                  put("created_at", cursor.getString(cursor.getColumnIndexOrThrow("created_at")))
                  put("updated_at", cursor.getString(cursor.getColumnIndexOrThrow("updated_at")))
                })
          }
        }

    val trackPoints = JSONArray()
    dbHelper.readableDatabase
        .rawQuery("SELECT * FROM track_points ORDER BY id ASC", null)
        .use { cursor ->
          while (cursor.moveToNext()) {
            trackPoints.put(
                JSONObject().apply {
                  put("id", cursor.getDouble(cursor.getColumnIndexOrThrow("id")))
                  put("latitude", cursor.getDouble(cursor.getColumnIndexOrThrow("latitude")))
                  put("longitude", cursor.getDouble(cursor.getColumnIndexOrThrow("longitude")))
                  put("recorded_at", cursor.getString(cursor.getColumnIndexOrThrow("recorded_at")))
                })
          }
        }

    val route = loadActiveRoute()
    return JSONObject().apply {
      put("export_id", exportId)
      put("device_id", ensureDeviceId())
      put("timestamp", isoNow())
      put("export_format", "WAYFINDER")
      put("schema_version", SCHEMA_VERSION)
      put("app_version", APP_VERSION)
      put("symbology_version", SYMBOLOGY_VERSION)
      put("pins", pins)
      put("track_points", trackPoints)
      put(
          "route",
          JSONObject().apply {
            put("id", route.id)
            put("name", route.name)
            put("pin_ids", JSONArray(route.pinIds))
            put("created_at", route.createdAt)
          })
    }
  }

  private fun buildKml(payload: JSONObject): String {
    val pins = payload.getJSONArray("pins")
    val trackPoints = payload.getJSONArray("track_points")
    val route = payload.optJSONObject("route") ?: JSONObject()
    val routePinIds = route.optJSONArray("pin_ids") ?: JSONArray()

    val pinById = mutableMapOf<String, JSONObject>()
    for (index in 0 until pins.length()) {
      val pin = pins.getJSONObject(index)
      pinById[pin.getString("id")] = pin
    }

    val builder = StringBuilder()
    builder.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
    builder.append("<kml xmlns=\"http://www.opengis.net/kml/2.2\">\n")
    builder.append("<Document>\n")
    builder.append("<name>${escapeXml(payload.optString("export_id"))}</name>\n")
    builder.append(
        "<description>Wayfinder AAR export ${escapeXml(payload.optString("timestamp"))}</description>\n")

    builder.append("<Folder><name>Pins</name>\n")
    for (index in 0 until pins.length()) {
      val pin = pins.getJSONObject(index)
      builder.append("<Placemark>\n")
      builder.append("<name>${escapeXml(pin.optString("label", pin.optString("category")))}</name>\n")
      builder.append(
          "<description>${escapeXml("${pin.optString("category")} / ${pin.optString("status_key")}")}</description>\n")
      builder.append("<Point><coordinates>")
      builder.append("${pin.getDouble("longitude")},${pin.getDouble("latitude")},0")
      builder.append("</coordinates></Point>\n")
      builder.append("</Placemark>\n")
    }
    builder.append("</Folder>\n")

    if (trackPoints.length() > 1) {
      builder.append("<Placemark><name>Movement Track</name><LineString><coordinates>\n")
      for (index in 0 until trackPoints.length()) {
        val point = trackPoints.getJSONObject(index)
        builder.append("${point.getDouble("longitude")},${point.getDouble("latitude")},0\n")
      }
      builder.append("</coordinates></LineString></Placemark>\n")
    }

    if (routePinIds.length() > 1) {
      builder.append("<Placemark><name>Route</name><LineString><coordinates>\n")
      for (index in 0 until routePinIds.length()) {
        val pin = pinById[routePinIds.optString(index)] ?: continue
        builder.append("${pin.getDouble("longitude")},${pin.getDouble("latitude")},0\n")
      }
      builder.append("</coordinates></LineString></Placemark>\n")
    }

    builder.append("</Document>\n")
    builder.append("</kml>\n")
    return builder.toString()
  }

  private fun escapeXml(value: String): String =
      value
          .replace("&", "&amp;")
          .replace("<", "&lt;")
          .replace(">", "&gt;")
          .replace("\"", "&quot;")
          .replace("'", "&apos;")

  private fun writePublicExportFile(
      filename: String,
      mimeType: String,
      content: String,
  ): com.facebook.react.bridge.WritableMap {
    val relativeFolder = "${Environment.DIRECTORY_DOWNLOADS}/$EXPORT_FOLDER"
    val publicPath =
        "${Environment.getExternalStorageDirectory().absolutePath}/$relativeFolder/$filename"

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val resolver = context.contentResolver
      deleteExistingDownload(resolver, filename, relativeFolder)

      val values =
          ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, filename)
            put(MediaStore.Downloads.MIME_TYPE, mimeType)
            put(MediaStore.Downloads.RELATIVE_PATH, relativeFolder)
            put(MediaStore.Downloads.IS_PENDING, 1)
          }
      val uri =
          resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
              ?: throw IllegalStateException("Unable to create export file in Downloads.")

      try {
        resolver.openOutputStream(uri, "w").use { output ->
          if (output == null) {
            throw IllegalStateException("Unable to write export file.")
          }
          output.write(content.toByteArray(Charsets.UTF_8))
        }
        values.clear()
        values.put(MediaStore.Downloads.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
      } catch (error: Exception) {
        resolver.delete(uri, null, null)
        throw error
      }

      return Arguments.createMap().apply {
        putString("filename", filename)
        putString("path", publicPath)
        putString("uri", uri.toString())
      }
    }

    val exportDir =
        File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), EXPORT_FOLDER)
    exportDir.mkdirs()
    val target = File(exportDir, filename)
    if (target.exists()) {
      target.delete()
    }
    target.writeText(content, Charsets.UTF_8)
    return Arguments.createMap().apply {
      putString("filename", filename)
      putString("path", target.absolutePath)
      putString("uri", Uri.fromFile(target).toString())
    }
  }

  private fun deleteExistingDownload(
      resolver: ContentResolver,
      filename: String,
      relativeFolder: String,
  ) {
    val collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI
    val selection =
        "${MediaStore.Downloads.DISPLAY_NAME} = ? AND ${MediaStore.Downloads.RELATIVE_PATH} = ?"
    val selectionArgs = arrayOf(filename, "$relativeFolder/")
    resolver.query(collection, arrayOf(MediaStore.Downloads._ID), selection, selectionArgs, null)
        ?.use { cursor ->
          val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Downloads._ID)
          while (cursor.moveToNext()) {
            val itemUri = ContentUris.withAppendedId(collection, cursor.getLong(idColumn))
            resolver.delete(itemUri, null, null)
          }
        }
  }

  companion object {
    private const val APP_VERSION = "0.4.3"
    private const val SCHEMA_VERSION = 1
    private const val SYMBOLOGY_VERSION = "1.0"
    private const val ACTIVE_ROUTE_ID = "active"
    private const val EXPORT_FOLDER = "NergalithWayfinder"
    private const val PIN_HASH_KEY = "pin_hash_sha256"
    private const val THEME_MODE_KEY = "theme_mode"
    private const val LANGUAGE_KEY = "language"
    private const val ACTIVE_MBTILES_PATH_KEY = "active_mbtiles_path"
    private const val DEVICE_ID_KEY = "device_id"
    private const val DEMO_MBTILES_FILENAME = "demo_bangui.mbtiles"
    private const val IMPORT_MBTILES_REQUEST_CODE = 4104
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
