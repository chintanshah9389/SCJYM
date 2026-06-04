# Web Push Notifications Setup Guide

## Overview

This guide explains how to set up **Web Push Notifications** for your mobile app when accessed through a web browser. 

**Important:** Web push works differently from native mobile push:
- ✅ **Native Mobile (Android/iOS)**: Uses Expo Push Tokens (already working)
- ✅ **Mobile Browser**: Uses Web Push API + Service Worker (this guide)

---

## What Changed

### Frontend (Mobile App)

1. **New Service Worker** (`apps/mobile/public/service-worker.js`)
   - Listens for incoming push notifications from the server
   - Displays system notifications to users
   - Handles notification clicks

2. **New Web Push Hook** (`apps/mobile/hooks/useWebPushNotifications.ts`)
   - Registers the service worker on web platforms
   - Requests notification permissions
   - Subscribes to web push using VAPID keys
   - Sends subscription to backend

3. **Updated AuthContext** 
   - Now calls both `usePushNotifications` (native) and `useWebPushNotifications` (web)

### Backend (API)

1. **New User Endpoint** (`PATCH /api/v1/users/me/web-push-subscription`)
   - Stores web push subscription (endpoint + encryption keys)

2. **Updated Notifications Router**
   - Sends to both FCM tokens (native) and web push subscriptions (browser)
   - New `send_web_push()` function using `pywebpush` library

3. **Configuration Updates**
   - `VAPID_PUBLIC_KEY`: Public key for web push (shared with frontend)
   - `VAPID_PRIVATE_KEY`: Private key for web push (kept secret on backend)

---

## Setup Steps

### Step 1: Generate VAPID Keys

VAPID (Voluntary Application Server Identification) keys are required for web push. Generate them:

```bash
cd services/api
python -c "from pywebpush import generate_keys; keys = generate_keys(); print(f'PUBLIC:\n{keys[\"public_key\"]}\n\nPRIVATE:\n{keys[\"private_key\"]}')"
```

This outputs:
```
PUBLIC:
BJxxxx...xxxxx

PRIVATE:
xxxx...xxxxx
```

### Step 2: Configure Backend

Edit `services/api/.env`:

```env
VAPID_PUBLIC_KEY=BJxxxx...xxxxx
VAPID_PRIVATE_KEY=xxxx...xxxxx
```

### Step 3: Configure Mobile App

Edit `apps/mobile/.env`:

```env
EXPO_PUBLIC_VAPID_PUBLIC_KEY=BJxxxx...xxxxx
```

**Note:** Only the PUBLIC key goes in the frontend. The PRIVATE key stays secret on the backend.

### Step 4: Install Backend Dependency

The backend uses `pywebpush` to send web push notifications:

```bash
cd services/api
pip install pywebpush==2.0.0
```

Or if using a requirements file:
```bash
pip install -r requirements.txt  # Already includes pywebpush
```

### Step 5: Restart Services

```bash
# Backend
cd services/api
python main.py

# Frontend (web)
cd apps/mobile
npm run web
```

---

## Testing Web Push

### 1. Open App in Browser

- Go to `http://localhost:8081` (or your web URL)
- Log in with a test user account

### 2. Grant Notification Permission

- Browser will ask: "Allow notifications?"
- Click **Allow**
- Check that web push subscription is saved to backend

### 3. Send Test Notification (EASIEST)

Use the test endpoint to send yourself a test notification:

```bash
curl -X POST http://localhost:8000/api/v1/notifications/test \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json"
```

Or via the app - add a button that calls:
```javascript
await api.post("/notifications/test")
```

You should immediately see a system notification popup!

### 4. Alternative: Send via Admin API

If using admin account:
```bash
curl -X POST http://localhost:8000/api/v1/admin/notifications/push \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "title": "Test Notification",
    "body": "This is a test web push",
    "deepLink": "https://example.com",
    "targetUserId": "USER_ID_HERE"
  }'
```

### 5. Verify Notification

- Should see system notification popup in browser
- Click to open the linked deep link
- Notification should appear in notification tab

---

## Testing Native Mobile

### 1. Build APK (Android) or IPA (iOS)

```bash
cd apps/mobile
eas build --platform android --profile preview
# or for iOS
eas build --platform ios --profile preview
```

### 2. Install and Run

```bash
# On physical device
eas build:run -platform android
```

### 3. Trigger Test Notification

```bash
curl -X POST http://YOUR_API/api/v1/notifications/test \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

You should see a system notification like WhatsApp!

---

## How It Works

### User Journey

```
1. User logs in on browser
   ↓
2. useWebPushNotifications hook runs
   ↓
3. Requests notification permission
   ↓
4. Registers service worker (/service-worker.js)
   ↓
5. Subscribes to push (using VAPID keys)
   ↓
6. Sends subscription to backend: PATCH /users/me/web-push-subscription
   ↓
7. Backend stores subscription in MongoDB
```

### Push Journey

```
1. Admin sends notification via API
   ↓
2. Backend collects user web push subscriptions
   ↓
3. Backend sends to Web Push Service (pushed by browser vendor)
   ↓
4. Service worker receives push event
   ↓
5. Service worker displays system notification
   ↓
6. User sees notification in browser/system tray
```

---

## Troubleshooting

### Notification Permission Never Appears

**Problem:** Browser doesn't ask for permission
**Solution:**
- Check browser console for errors
- Ensure VAPID_PUBLIC_KEY is set in `.env`
- Clear browser storage and reload

### Notifications Not Arriving

**Problem:** Subscription saves but notifications don't arrive
**Checks:**
1. Verify `VAPID_PRIVATE_KEY` is set on backend
2. Check backend logs for `send_web_push` errors
3. Ensure `pywebpush` is installed: `pip list | grep pywebpush`
4. Verify subscription endpoint is valid in database

### Service Worker Not Registering

**Problem:** Service worker registration fails
**Solution:**
- Ensure `public/service-worker.js` exists
- Check browser DevTools → Application → Service Workers
- Look for errors in console

### "pywebpush not installed" Error

**Problem:** Backend shows warning about missing pywebpush
**Solution:**
```bash
pip install pywebpush==2.0.0
```

---

## Important Notes

### Security

- ⚠️ **NEVER** commit `VAPID_PRIVATE_KEY` to version control
- Keep `VAPID_PRIVATE_KEY` secret and secure
- `VAPID_PUBLIC_KEY` is safe to expose (it's used in frontend)

### Browser Support

Web Push is supported on:
- ✅ Chrome/Edge (all versions)
- ✅ Firefox (all versions)
- ✅ Safari 16+ (limited support)
- ❌ Safari < 16 (not supported)

### Subscriptions

- Each browser/device gets a unique subscription
- Subscriptions are stored in MongoDB per user
- If a subscription fails, it's logged but not automatically removed
- Users can revoke notification permission anytime

---

## Files Modified/Created

- ✅ `apps/mobile/public/service-worker.js` - NEW
- ✅ `apps/mobile/hooks/useWebPushNotifications.ts` - NEW
- ✅ `apps/mobile/context/AuthContext.tsx` - UPDATED (added useWebPushNotifications)
- ✅ `services/api/routers/users.py` - UPDATED (added web-push-subscription endpoint)
- ✅ `services/api/routers/notifications.py` - UPDATED (added send_web_push function)
- ✅ `services/api/core/config.py` - UPDATED (added VAPID keys)
- ✅ `services/api/requirements.txt` - UPDATED (added pywebpush)
- ✅ `apps/mobile/.env.example` - UPDATED
- ✅ `services/api/.env.example` - UPDATED

---

## Next Steps

1. Generate VAPID keys (Step 1 above)
2. Configure both frontend and backend with keys
3. Install pywebpush on backend
4. Restart services
5. Test with a browser notification
6. Deploy to production with proper VAPID key management

---

## References

- [Web Push Protocol (RFC 8291)](https://tools.ietf.org/html/draft-ietf-webpush-protocol)
- [VAPID Specification](https://tools.ietf.org/html/draft-thomson-webpush-vapid)
- [MDN - Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [pywebpush Documentation](https://github.com/web-push-libs/pywebpush)
