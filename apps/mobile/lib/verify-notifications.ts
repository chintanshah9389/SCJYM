/**
 * Frontend Push Notification Verification Helper
 * 
 * Run in browser console to verify web push setup:
 * 
 * import { verifyPushNotifications } from '@/lib/verify-notifications'
 * await verifyPushNotifications()
 */

export async function verifyPushNotifications(): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 PUSH NOTIFICATION VERIFICATION (Frontend)");
  console.log("=".repeat(60));

  const results: Record<string, boolean> = {};

  // Check 1: Browser Support
  console.log("\n🔍 Checking Browser Support...");
  results["ServiceWorker Support"] = "serviceWorker" in navigator;
  results["PushManager Support"] = "PushManager" in window;
  results["Notification API"] = "Notification" in window;

  Object.entries(results).forEach(([check, supported]) => {
    const status = supported ? "✅" : "❌";
    console.log(`  ${status} ${check}`);
  });

  // Check 2: VAPID Key
  console.log("\n🔍 Checking VAPID Configuration...");
  const vapidKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  results["VAPID_PUBLIC_KEY"] = !!vapidKey;
  
  if (vapidKey) {
    console.log(`  ✅ VAPID_PUBLIC_KEY: Set (${vapidKey.length} chars)`);
  } else {
    console.log(`  ❌ VAPID_PUBLIC_KEY: NOT SET`);
  }

  // Check 3: Service Worker Registration
  console.log("\n🔍 Checking Service Worker...");
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    results["Service Worker Registered"] = registrations.length > 0;
    
    if (registrations.length > 0) {
      console.log(`  ✅ Service Worker Registered (${registrations.length} active)`);
      registrations.forEach((reg, i) => {
        console.log(`     ${i + 1}. Scope: ${reg.scope}`);
        console.log(`        State: ${reg.active ? "ACTIVE ✅" : "INACTIVE ❌"}`);
      });
    } else {
      console.log(`  ❌ No Service Workers registered`);
      console.log(`     Run: await navigator.serviceWorker.register('/service-worker.js')`);
    }
  } catch (error) {
    console.log(`  ❌ Service Worker check failed:`, error);
    results["Service Worker Registered"] = false;
  }

  // Check 4: Notification Permission
  console.log("\n🔍 Checking Notification Permission...");
  const permission = Notification.permission;
  results["Notification Permission"] = permission === "granted";
  
  console.log(`  ${permission === "granted" ? "✅" : "❌"} Permission: ${permission}`);
  if (permission !== "granted") {
    console.log(`     To grant: Click the notification permission dialog`);
  }

  // Check 5: Push Subscription
  console.log("\n🔍 Checking Push Subscription...");
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length > 0) {
      const reg = registrations[0];
      const subscription = await reg.pushManager.getSubscription();
      results["Push Subscription"] = !!subscription;
      
      if (subscription) {
        console.log(`  ✅ Push Subscription Active`);
        console.log(`     Endpoint: ${subscription.endpoint.substring(0, 50)}...`);
        const p256dhKey = subscription.getKey("p256dh");
        const authKey = subscription.getKey("auth");
        const hasKeys = !!p256dhKey && !!authKey;
        console.log(`     Keys: ${hasKeys ? "✅ Present" : "❌ Missing"}`);
      } else {
        console.log(`  ❌ No Push Subscription found`);
        console.log(`     Next step: Log in to trigger subscription`);
      }
    }
  } catch (error) {
    console.log(`  ❌ Push subscription check failed:`, error);
    results["Push Subscription"] = false;
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 SUMMARY");
  console.log("=".repeat(60));
  
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  Object.entries(results).forEach(([check, result]) => {
    const status = result ? "✅ PASS" : "❌ FAIL";
    console.log(`  ${status}: ${check}`);
  });

  console.log(`\n  Total: ${passed}/${total} checks passed`);

  if (passed === total) {
    console.log("\n🎉 All checks passed! Push notifications are ready.");
    console.log("\nNext: Test with:");
    console.log("  const response = await fetch('http://localhost:8000/api/v1/notifications/test', {");
    console.log("    method: 'POST',");
    console.log("    headers: {");
    console.log("      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,");
    console.log("      'Content-Type': 'application/json'");
    console.log("    }");
    console.log("  })");
  } else {
    console.log(`\n⚠️  ${total - passed} check(s) failed. Fix the issues above.`);
  }
  
  console.log("=".repeat(60) + "\n");
}

// Export for testing
export function testNotificationSupport(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}
