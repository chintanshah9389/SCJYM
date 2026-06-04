#!/usr/bin/env python
"""
Android Push Notification Pre-Flight Checklist
Run this before building APK to verify everything is ready.
"""
import os
import sys
import json
from pathlib import Path


def check_backend_env():
    """Check backend has all required environment variables."""
    print("\n🔍 Backend Configuration Check")
    print("=" * 50)
    
    required_vars = {
        "FCM_SERVER_KEY": "Firebase Server Key",
        "VAPID_PUBLIC_KEY": "Web Push Public Key",
        "VAPID_PRIVATE_KEY": "Web Push Private Key",
        "MONGODB_URI": "Database URL",
    }
    
    all_good = True
    for var, description in required_vars.items():
        value = os.getenv(var)
        if value:
            # Show first 20 chars and length
            display = value[:20] + "..." if len(value) > 20 else value
            print(f"✅ {var:20} ({len(value)} chars)")
        else:
            print(f"❌ {var:20} MISSING!")
            print(f"   └─ {description}")
            all_good = False
    
    return all_good


def check_mobile_env():
    """Check mobile app has required configuration."""
    print("\n🔍 Mobile App Configuration Check")
    print("=" * 50)
    
    env_file = "apps/mobile/.env"
    
    if not Path(env_file).exists():
        print(f"❌ {env_file} NOT FOUND")
        return False
    
    with open(env_file, "r") as f:
        content = f.read()
    
    checks = {
        "EXPO_PUBLIC_EAS_PROJECT_ID": "EAS Project ID",
        "EXPO_PUBLIC_API_BASE_URL": "API Base URL",
    }
    
    all_good = True
    for var, description in checks.items():
        if var in content:
            print(f"✅ {var:40} Found")
        else:
            print(f"❌ {var:40} Missing!")
            all_good = False
    
    return all_good


def check_firebase_setup():
    """Check Firebase configuration file."""
    print("\n🔍 Firebase Setup Check")
    print("=" * 50)
    
    files_to_check = [
        ("apps/mobile/google-services.json", "Android"),
        ("apps/mobile/GoogleService-Info.plist", "iOS"),
    ]
    
    all_good = True
    for filepath, platform in files_to_check:
        if Path(filepath).exists():
            file_size = Path(filepath).stat().st_size
            print(f"✅ {filepath:45} ({file_size} bytes)")
            
            # For JSON files, try to parse
            if filepath.endswith(".json"):
                try:
                    with open(filepath, "r") as f:
                        data = json.load(f)
                    project_id = data.get("project_id", "unknown")
                    print(f"   └─ Project: {project_id}")
                except Exception as e:
                    print(f"   └─ ⚠️ Warning: Could not parse JSON: {e}")
        else:
            print(f"❌ {filepath:45} MISSING!")
            all_good = False
    
    return all_good


def check_eas_setup():
    """Check EAS configuration."""
    print("\n🔍 EAS Build Configuration Check")
    print("=" * 50)
    
    eas_file = "apps/mobile/eas.json"
    
    if not Path(eas_file).exists():
        print(f"❌ {eas_file} NOT FOUND")
        return False
    
    try:
        with open(eas_file, "r") as f:
            eas_config = json.load(f)
        
        # Check for android profile
        if "build" in eas_config and "preview" in eas_config["build"]:
            print(f"✅ eas.json structure looks good")
            
            if "android" in eas_config["build"]["preview"]:
                print(f"✅ Android preview profile configured")
                return True
            else:
                print(f"⚠️ No Android preview profile")
                return False
        else:
            print(f"❌ Invalid eas.json structure")
            return False
    except Exception as e:
        print(f"❌ Error reading eas.json: {e}")
        return False


def check_app_setup():
    """Check app.json for notification setup."""
    print("\n🔍 App Configuration Check (app.json)")
    print("=" * 50)
    
    app_file = "apps/mobile/app.json"
    
    if not Path(app_file).exists():
        print(f"❌ {app_file} NOT FOUND")
        return False
    
    try:
        with open(app_file, "r") as f:
            app_config = json.load(f)
        
        expo = app_config.get("expo", {})
        
        checks = {
            "plugins": ("expo-notifications", "Notification plugin"),
            "android.package": ("com.scjygm.app", "Android package"),
            "android.googleServicesFile": ("google-services.json", "Google Services"),
        }
        
        all_good = True
        
        # Check plugins
        plugins = expo.get("plugins", [])
        has_notifications = any(
            p == "expo-notifications" or (isinstance(p, list) and p[0] == "expo-notifications")
            for p in plugins
        )
        if has_notifications:
            print(f"✅ expo-notifications plugin configured")
        else:
            print(f"❌ expo-notifications plugin NOT found")
            all_good = False
        
        # Check android config
        android = expo.get("android", {})
        if android.get("package"):
            print(f"✅ Android package: {android['package']}")
        else:
            print(f"❌ Android package NOT configured")
            all_good = False
        
        if android.get("googleServicesFile"):
            print(f"✅ Google Services file: {android['googleServicesFile']}")
        else:
            print(f"❌ Google Services file NOT configured")
            all_good = False
        
        return all_good
    except Exception as e:
        print(f"❌ Error reading app.json: {e}")
        return False


def check_nodejs_setup():
    """Check if Node and dependencies are installed."""
    print("\n🔍 Node.js & Dependencies Check")
    print("=" * 50)
    
    # Check node_modules
    mobile_modules = Path("apps/mobile/node_modules")
    if mobile_modules.exists():
        print(f"✅ Mobile node_modules installed")
    else:
        print(f"❌ Mobile node_modules NOT installed")
        print(f"   Run: cd apps/mobile && npm install")
        return False
    
    # Check key packages
    key_packages = [
        "expo",
        "expo-notifications",
        "expo-router",
    ]
    
    all_good = True
    for package in key_packages:
        package_dir = mobile_modules / package
        if package_dir.exists():
            print(f"✅ {package:30} installed")
        else:
            print(f"❌ {package:30} MISSING")
            all_good = False
    
    return all_good


def main():
    """Run all pre-flight checks."""
    print("\n" + "=" * 50)
    print("🚀 ANDROID PUSH NOTIFICATION PRE-FLIGHT CHECK")
    print("=" * 50)
    
    checks = {
        "Backend Configuration": check_backend_env,
        "Mobile Configuration": check_mobile_env,
        "Firebase Setup": check_firebase_setup,
        "EAS Build Config": check_eas_setup,
        "App.json Setup": check_app_setup,
        "Node Dependencies": check_nodejs_setup,
    }
    
    results = {}
    for check_name, check_func in checks.items():
        try:
            results[check_name] = check_func()
        except Exception as e:
            print(f"❌ Error during {check_name}: {e}")
            results[check_name] = False
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for check_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status}: {check_name}")
    
    print(f"\n  Total: {passed}/{total} checks passed")
    
    if passed == total:
        print("\n🎉 Ready to build Android APK!")
        print("\nNext steps:")
        print("  1. cd apps/mobile")
        print("  2. eas build --platform android --profile preview")
        print("\nThen wait for build to complete, download APK, and test on your phone!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} check(s) failed!")
        print("\nFix the issues above before building.")
        print("\nTips:")
        print("  • Make sure .env files are in the correct locations")
        print("  • Check that google-services.json is valid JSON")
        print("  • Run: npm install in apps/mobile/ if dependencies are missing")
        return 1


if __name__ == "__main__":
    sys.exit(main())
