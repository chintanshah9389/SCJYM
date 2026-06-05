@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "ANDROID_DIR=%ROOT_DIR%android"
set "APK_PATH=%ANDROID_DIR%\app\build\outputs\apk\release\app-release.apk"
set "GOOGLE_SRC=%ROOT_DIR%google-services.json"
set "GOOGLE_DST=%ANDROID_DIR%\app\google-services.json"

echo [fast-apk] Building RELEASE APK for physical Android devices...
echo [fast-apk] This skips lint/tests and targets arm64-v8a for faster local builds.

if not exist "%ANDROID_DIR%\gradlew.bat" (
  echo [fast-apk] ERROR: Could not find gradlew.bat in %ANDROID_DIR%
  exit /b 1
)

if not exist "%GOOGLE_SRC%" (
  echo [fast-apk] ERROR: Missing %GOOGLE_SRC%
  exit /b 1
)

echo [fast-apk] Step 1/2: Copying Firebase config...
copy /Y "%GOOGLE_SRC%" "%GOOGLE_DST%" >nul
if errorlevel 1 (
  echo [fast-apk] ERROR: Could not copy google-services.json to android/app
  exit /b 1
)

echo [fast-apk] Step 2/3: Assembling APK with JS bundle (Gradle)...
pushd "%ANDROID_DIR%"
call gradlew.bat :app:assembleRelease -x lint -x test -PreactNativeArchitectures=arm64-v8a
set "GRADLE_EXIT=%ERRORLEVEL%"
popd

if not "%GRADLE_EXIT%"=="0" (
  echo [fast-apk] Build failed with exit code %GRADLE_EXIT%
  exit /b %GRADLE_EXIT%
)

if exist "%APK_PATH%" (
  echo.
  echo [fast-apk] ============================================
  echo [fast-apk] Build SUCCESS
  echo [fast-apk] APK: %APK_PATH%
  echo [fast-apk] ============================================
  exit /b 0
)

echo [fast-apk] Build finished but APK not found at expected path:
echo [fast-apk] %APK_PATH%
exit /b 1
