# Quick Notification Testing Guide

## Issue Fixed

Push notifications now work in **both mobile (native) and browser** by:
1. ✅ Frontend properly listening for incoming notifications
2. ✅ Backend sending push when notifications are created
3. ✅ Test endpoint to verify setup

---

## Quick Test (5 minutes)

### Step 1: Configure VAPID Keys

Generate once:
```bash
cd services/api
python -c "from pywebpush import generate_keys; keys = generate_keys(); print(f'PUBLIC:\\n{keys[\"public_key\"]}\\n\\nPRIVATE:\\n{keys[\"private_key\"]}')"
```

Add to `services/api/.env`:
```env
VAPID_PUBLIC_KEY=BJxxxx...xxxxx
VAPID_PRIVATE_KEY=xxxx...xxxxx
```

Add to `apps/mobile/.env`:
```env
EXPO_PUBLIC_VAPID_PUBLIC_KEY=BJxxxx...xxxxx
```

### Step 2: Install & Restart

```bash
cd services/api
pip install pywebpush==2.0.0
python main.py
```

### Step 3: Test in Browser

1. Open `http://localhost:8081`
2. Log in
3. Grant notification permission when asked
4. Run this in browser console or via API:

```bash
curl -X POST http://localhost:8000/api/v1/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Result:** You should see a system notification popup! ✅

### Step 4: Test on Native Mobile

1. Build and install on physical device
2. Log in and grant permissions
3. Run same test endpoint
4. Should see notification like WhatsApp!

---

## What Changed

| Component | What Was Wrong | What's Fixed |
|-----------|----------------|-------------|
| **Frontend (Native)** | Listeners not registered | Added `addNotificationReceivedListener` + `addNotificationResponseReceivedListener` |
| **Frontend (Web)** | Service worker not listening | Created service worker + listener for push events |
| **Frontend (Web)** | Badge not showing | Added `shouldSetBadge: true` to notification handler |
| **Backend** | No auto push send | Created `create_and_send_notification()` + `send_web_push()` functions |
| **Testing** | No easy way to test | Added `POST /notifications/test` endpoint |

---

## Files Updated

- `apps/mobile/hooks/usePushNotifications.ts` - Added listeners
- `apps/mobile/hooks/useWebPushNotifications.ts` - Created web push hook
- `apps/mobile/public/service-worker.js` - Created service worker
- `services/api/routers/notifications.py` - Added helper + test endpoint
- `services/api/core/notifications_helper.py` - Created reusable utility

---

## Troubleshooting

### No notification appears

**Check 1:** Browser console for errors
```javascript
// In browser DevTools Console:
// Check if service worker is registered
navigator.serviceWorker.getRegistrations().then(regs => console.log(regs))
```

**Check 2:** Backend logs
```
Look for: "FCM push sent" or "Web push sent"
```

**Check 3:** VAPID keys
```bash
# Verify keys are in .env
echo $VAPID_PUBLIC_KEY
echo $VAPID_PRIVATE_KEY
```

### "VAPID keys not configured"

**Fix:** Make sure both PRIVATE and PUBLIC are in backend `.env`, NOT just one.

### "pywebpush not installed"

**Fix:**
```bash
pip install pywebpush==2.0.0
```

### Notification shows in tab but not as popup

**Native Mobile:** 
- Ensure `shouldShowAlert: true` in notification handler ✅ FIXED

**Browser:**
- Check service worker is running (DevTools → Application → Service Workers)
- Ensure notification permission is granted

---

## How to Use in Your App

When notifications should be sent (e.g., when a user comments):

```python
from core.notifications_helper import notify_user

await notify_user(
    db,
    user_id="USER_ID",
    title="New Comment",
    body="Someone commented on your product",
    image_url="https://...",
    deep_link="app://product/123"
)
```

This will:
1. ✅ Create notification in database
2. ✅ Send push to native mobile
3. ✅ Send push to browser

---

## Next Steps

1. **Test** with the curl command above
2. **Verify** notifications appear (both tab + popup)
3. **Integrate** `notify_user()` in other routers (ratings, comments, etc.)
4. **Deploy** VAPID keys to production environment

---
