# 🤖 Android Push Notifications Testing Guide

## What You Need ✅

Before testing, make sure you have:
- [ ] Google-services.json file (in apps/mobile/) - ✅ You have this
- [ ] FCM_SERVER_KEY in backend .env - Check your env
- [ ] EXPO_PUBLIC_EAS_PROJECT_ID in mobile .env - ✅ You have this
- [ ] Physical Android device (or emulator)
- [ ] Backend running: `python services/api/main.py`

---

## 📱 Option 1: Build for Physical Device (RECOMMENDED)

### **Step 1: Check EAS Configuration**

```bash
cd apps/mobile
cat eas.json
```

Should have Android profile. If missing, create it:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "aab"
      }
    }
  }
}
```

### **Step 2: Build APK for Android**

```bash
cd apps/mobile
eas build --platform android --profile preview
```

This creates a .apk file you can install on your phone.

**Wait for build to complete** (5-10 minutes) ☕

### **Step 3: Download & Install APK**

Once build completes:
1. Download the APK from EAS console
2. Transfer to your Android phone
3. Tap to install and grant permissions

### **Step 4: Test Notification**

**On your phone:**
1. Open the app
2. Log in with your account
3. Grant notification permission when asked

**From your computer:**
```bash
# Get your user token (after logging in, check browser storage)
curl -X POST http://localhost:8000/api/v1/notifications/test \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected on phone:**
- 🔔 System notification popup appears!
- Notification shows in system tray
- Can tap to open app

---

## 🖥️ Option 2: Test with Android Emulator (FASTER)

### **Step 1: Install Android Emulator**

If you don't have it:
```bash
# Download Android Studio
# Create AVD (Android Virtual Device)
```

Or use existing emulator.

### **Step 2: Start Emulator**

```bash
# List available emulators
emulator -list-avds

# Start emulator
emulator -avd <emulator_name>
```

### **Step 3: Run App on Emulator**

```bash
cd apps/mobile
expo run:android
```

This builds and installs app on emulator automatically.

### **Step 4: Grant Permissions**

When app starts:
1. Allow notification permission
2. Log in to app

### **Step 5: Send Test Notification**

```bash
curl -X POST http://localhost:8000/api/v1/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**You should see notification on emulator!** ✅

---

## 🔍 Verify FCM Setup

Before building, verify Firebase is configured:

### **Check Firebase credentials:**

```bash
cat apps/mobile/google-services.json | grep -A5 "project_id\|client_id"
```

Should show:
```json
"project_id": "your-project-id",
"api_key": "your-api-key"
```

### **Check backend has FCM key:**

```bash
echo $FCM_SERVER_KEY
```

Should show your Firebase Server Key (from Firebase Console).

---

## 🧪 Testing Checklist

### Backend Setup:
- [ ] Backend running (`python services/api/main.py`)
- [ ] VAPID_PUBLIC_KEY set in .env
- [ ] VAPID_PRIVATE_KEY set in .env
- [ ] FCM_SERVER_KEY set in .env
- [ ] pip install pywebpush==2.0.0

### Mobile App Setup:
- [ ] EXPO_PUBLIC_EAS_PROJECT_ID in .env ✅
- [ ] google-services.json present ✅
- [ ] App builds successfully
- [ ] App installs on device/emulator

### Runtime Testing:
- [ ] App starts
- [ ] Notification permission granted
- [ ] User logged in
- [ ] Test endpoint receives 200 response
- [ ] 🔔 Notification appears on device!

---

## 🔧 Debugging - If Notification Doesn't Appear

### **Check 1: App is in foreground**

Notification should show even while app is open (we set `shouldShowAlert: true`)

```typescript
// In usePushNotifications.ts
shouldShowAlert: true,  // ✅ This is set
shouldPlaySound: true,
shouldSetBadge: true,
```

### **Check 2: Look at console logs**

When app starts, should see:
```
🔔 Registering for push notifications...
🔔 Got token: ExponentPushToken[......]
✅ FCM token saved to backend
```

If you see errors, let me know!

### **Check 3: Check backend logs**

Should show:
```
📤 FCM push sent to user xxx
```

If you see "FCM_SERVER_KEY is missing", add it to backend .env!

### **Check 4: Verify token was saved**

Check MongoDB:
```bash
# Connect to MongoDB and run:
db.users.findOne({email: "your@email.com"}).fcmToken
# Should show: ExponentPushToken[...]
```

---

## 🚀 Full Test Flow

**1. Start backend:**
```bash
cd services/api
python main.py
```

**2. Build app:**
```bash
cd apps/mobile
eas build --platform android --profile preview
```

Wait for build... ☕

**3. Install on phone/emulator**

**4. Open app, log in, grant permissions**

**5. Send test notification:**
```bash
curl -X POST http://localhost:8000/api/v1/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**6. Check phone for notification** 🔔

---

## ✅ Expected Behavior

### When notification sent:

**Android Phone:**
```
┌─────────────────────┐
│ SCJYGM              │
│ Test Notification   │
│                     │
│ If you see this,... │
│                     │
│ ← Tap to open       │
└─────────────────────┘
```

- Shows as system notification
- Sound plays
- Vibrates (if configured)
- Shows in notification tray
- Can tap to open app

**Backend Logs:**
```
📤 FCM push sent to user xxx
```

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| "FCM_SERVER_KEY is missing" | Add `FCM_SERVER_KEY` to `services/api/.env` |
| "No push token obtained" | Ensure notification permission granted |
| Notification not showing | Check app logs for `ExponentPushToken` |
| App crashes on startup | Ensure `expo-notifications` is installed |
| Build fails | Run `npm install` in `apps/mobile/` |

---

## Next: Deploy & Test Live

Once working locally:

1. Push code to GitHub
2. Add VAPID keys to Render environment
3. Deploy backend to Render
4. Update mobile app to use production API
5. Build final APK
6. Test with production API

---

**Ready? Let's start! Run this:**

```bash
cd apps/mobile
eas build --platform android --profile preview
```

Let me know if build succeeds! 🚀
