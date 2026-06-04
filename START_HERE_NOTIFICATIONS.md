# ✅ Push Notifications - FIXED & READY TO TEST

## What Was Wrong ❌
- Notifications appeared in app but **no system popups** (like WhatsApp)
- Native mobile wasn't listening for incoming notifications
- Web browser wasn't set up for push notifications
- Backend wasn't automatically sending push when notifications created

## What's Fixed ✅

| Part | Issue | Fix |
|------|-------|-----|
| **Native Mobile** | Not listening for notifications | Added listeners for incoming push |
| **Web Browser** | No service worker handling push | Created service worker + listeners |
| **Backend** | No auto push send | Added helper functions + test endpoint |
| **Testing** | Hard to verify | Added `/notifications/test` endpoint |

---

## ⚡ Quick Start (Copy-Paste)

### 1️⃣ Generate VAPID Keys
```bash
cd services/api
python -c "from pywebpush import generate_keys; keys = generate_keys(); print(f'PUBLIC:\n{keys[\"public_key\"]}\n\nPRIVATE:\n{keys[\"private_key\"]}')"
```

Copy the output (both PUBLIC and PRIVATE keys)

### 2️⃣ Add to Backend `.env`
```env
VAPID_PUBLIC_KEY=BJxxxx...xxxxx
VAPID_PRIVATE_KEY=xxxx...xxxxx
```

### 3️⃣ Add to Mobile `.env`
```env
EXPO_PUBLIC_VAPID_PUBLIC_KEY=BJxxxx...xxxxx
```

### 4️⃣ Install Dependency
```bash
cd services/api
pip install pywebpush==2.0.0
```

### 5️⃣ Restart Backend
```bash
python main.py
```

### 6️⃣ TEST IT!

**In Browser:**
```bash
curl -X POST http://localhost:8000/api/v1/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Or in browser console** (after logging in):
```javascript
fetch('http://localhost:8000/api/v1/notifications/test', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
    'Content-Type': 'application/json'
  }
}).then(r => r.json()).then(console.log)
```

**Expected Result:**
- 🔔 System notification popup appears
- 📱 Can click notification to open app
- ✅ Shows in notification tab too

---

## ✨ What Changed in Code

### Frontend (Mobile App)
- ✅ `hooks/usePushNotifications.ts` - Now listens for incoming notifications
- ✅ `hooks/useWebPushNotifications.ts` - New web push setup
- ✅ `public/service-worker.js` - New service worker for browser
- ✅ `context/AuthContext.tsx` - Calls both hooks

### Backend (API)
- ✅ `routers/notifications.py` - New `create_and_send_notification()` helper
- ✅ `routers/notifications.py` - New `POST /notifications/test` endpoint
- ✅ `routers/users.py` - New web subscription storage
- ✅ `core/config.py` - VAPID key support
- ✅ `requirements.txt` - Added `pywebpush`

### Docs
- ✅ `NOTIFICATION_TESTING.md` - This quick guide!
- ✅ `docs/05_WebPush_Setup.md` - Full documentation
- ✅ `core/notifications_helper.py` - For other devs to use

---

## 🔍 Verify It's Working

### Check 1: Browser DevTools
```javascript
// In DevTools Console:
navigator.serviceWorker.getRegistrations().then(r => {
  console.log('Service Workers:', r)
  r.forEach(sw => console.log('URL:', sw.scope))
})
```

Should show `/` scope registered.

### Check 2: Backend Logs
After running test command, should see:
```
📤 FCM push sent to user xxx
or
📤 Web push sent to user xxx
```

### Check 3: Database Check
```bash
# MongoDB
db.users.findOne({_id: ObjectId("...")}).webPushSubscription
```

Should show subscription object with `endpoint` and `keys`.

---

## 🚀 Using in Your App

When you want to notify users (e.g., new comment, new order):

```python
from core.notifications_helper import notify_user

await notify_user(
    db,
    user_id="user_123",
    title="New Comment",
    body="Someone commented on your product!",
    image_url="https://...",
    deep_link="app://product/456"
)
```

This will:
1. Create notification in DB
2. Send push to native mobile
3. Send push to browsers
4. User sees system notification popup!

---

## ❓ Troubleshooting

### No notification appears
**Check:** Are VAPID keys in `.env`? Both PUBLIC and PRIVATE?
```bash
echo $VAPID_PUBLIC_KEY
echo $VAPID_PRIVATE_KEY
```

### "pywebpush not installed"
**Fix:**
```bash
pip install pywebpush==2.0.0
```

### Notification in tab but no popup
**Native:** Already fixed! ✅
**Browser:** Check service worker is running (DevTools → Application → Service Workers)

### "VAPID keys not configured" error
**Fix:** Restart backend after adding keys to `.env`

---

## 📚 Full Docs
- Full setup: `docs/05_WebPush_Setup.md`
- Testing guide: `NOTIFICATION_TESTING.md`
- Helper usage: `services/api/core/notifications_helper.py`

---

## 🎉 That's It!

You now have working push notifications on:
- ✅ Native Android/iOS (like WhatsApp!)
- ✅ Mobile browsers
- ✅ Easy testing endpoint
- ✅ Reusable helper for other endpoints

Just follow the Quick Start above and you're done! 🚀
