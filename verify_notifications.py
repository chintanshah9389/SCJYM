#!/usr/bin/env python
"""
Push Notification Verification Script
Checks if all components are properly configured and working.
"""
import os
import sys
from pathlib import Path


def check_backend_env():
    """Check backend environment variables."""
    print("\n🔍 Checking Backend Configuration...")
    
    vapid_public = os.getenv("VAPID_PUBLIC_KEY")
    vapid_private = os.getenv("VAPID_PRIVATE_KEY")
    
    checks = {
        "VAPID_PUBLIC_KEY": vapid_public,
        "VAPID_PRIVATE_KEY": vapid_private,
    }
    
    for key, value in checks.items():
        if value:
            print(f"  ✅ {key}: Set ({len(value)} chars)")
        else:
            print(f"  ❌ {key}: NOT SET")
    
    return all(checks.values())


def check_pywebpush():
    """Check if pywebpush is installed."""
    print("\n🔍 Checking Python Dependencies...")
    
    try:
        import pywebpush
        print(f"  ✅ pywebpush: Installed (v{pywebpush.__version__ if hasattr(pywebpush, '__version__') else 'unknown'})")
        return True
    except ImportError:
        print("  ❌ pywebpush: NOT INSTALLED")
        print("     Run: pip install pywebpush==2.0.0")
        return False


def check_backend_files():
    """Check if backend notification files exist."""
    print("\n🔍 Checking Backend Files...")
    
    files_to_check = [
        "services/api/routers/notifications.py",
        "services/api/core/config.py",
        "services/api/core/notifications_helper.py",
    ]
    
    all_exist = True
    for filepath in files_to_check:
        if Path(filepath).exists():
            print(f"  ✅ {filepath}")
        else:
            print(f"  ❌ {filepath}: NOT FOUND")
            all_exist = False
    
    return all_exist


def check_frontend_files():
    """Check if frontend notification files exist."""
    print("\n🔍 Checking Frontend Files...")
    
    files_to_check = [
        "apps/mobile/hooks/usePushNotifications.ts",
        "apps/mobile/hooks/useWebPushNotifications.ts",
        "apps/mobile/public/service-worker.js",
        "apps/mobile/context/AuthContext.tsx",
    ]
    
    all_exist = True
    for filepath in files_to_check:
        if Path(filepath).exists():
            print(f"  ✅ {filepath}")
        else:
            print(f"  ❌ {filepath}: NOT FOUND")
            all_exist = False
    
    return all_exist


def check_notifications_router():
    """Check if notifications router has required functions."""
    print("\n🔍 Checking Notifications Router Functions...")
    
    try:
        with open("services/api/routers/notifications.py", "r") as f:
            content = f.read()
        
        functions = [
            "send_fcm_push",
            "send_web_push",
            "create_and_send_notification",
            'POST /notifications/test'  # Route marker
        ]
        
        all_found = True
        for func in functions:
            if func in content:
                print(f"  ✅ {func}")
            else:
                print(f"  ❌ {func}: NOT FOUND")
                all_found = False
        
        return all_found
    except Exception as e:
        print(f"  ❌ Error reading notifications router: {e}")
        return False


def main():
    """Run all verification checks."""
    print("=" * 60)
    print("🚀 PUSH NOTIFICATION VERIFICATION")
    print("=" * 60)
    
    results = {
        "Backend Configuration": check_backend_env(),
        "Python Dependencies": check_pywebpush(),
        "Backend Files": check_backend_files(),
        "Frontend Files": check_frontend_files(),
        "Notification Router": check_notifications_router(),
    }
    
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for check, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status}: {check}")
    
    print(f"\n  Total: {passed}/{total} checks passed")
    
    if passed == total:
        print("\n🎉 All checks passed! Push notifications are ready to test.")
        print("\nNext: Run this to send a test notification:")
        print("  curl -X POST http://localhost:8000/api/v1/notifications/test \\")
        print("    -H 'Authorization: Bearer YOUR_TOKEN' \\")
        print("    -H 'Content-Type: application/json'")
        return 0
    else:
        print(f"\n⚠️  {total - passed} check(s) failed. Fix the issues above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
