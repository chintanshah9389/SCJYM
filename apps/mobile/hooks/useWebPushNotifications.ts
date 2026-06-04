/**
 * Web Push notification hook for browser environments.
 * Registers service worker and subscribes to web push notifications.
 */
import { useEffect } from 'react';
import { api } from '@/lib/api';

const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;

export function useWebPushNotifications(userId?: string) {
  useEffect(() => {
    if (!userId || typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('⚠️ Push notifications not supported in this browser');
      return;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.warn('⚠️ EXPO_PUBLIC_VAPID_PUBLIC_KEY not configured');
      return;
    }

    (async () => {
      try {
        // Register service worker
        console.log('🔔 Registering service worker...');
        const registration = await navigator.serviceWorker.register(
          '/service-worker.js',
          { scope: '/' }
        );
        console.log('✅ Service worker registered');

        // Check if already subscribed
        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) {
          console.log('✅ Already subscribed to push notifications');
          return;
        }

        // Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.warn('⚠️ Notification permission denied');
          return;
        }

        // Subscribe to push
        console.log('🔔 Subscribing to push notifications...');
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        // Send subscription to backend
        await api.patch('/users/me/web-push-subscription', {
          subscription: subscription.toJSON(),
        });
        console.log('✅ Web push subscription sent to backend');
      } catch (error) {
        console.error('❌ Web push setup error:', error);
      }
    })();
  }, [userId]);
}

/**
 * Convert VAPID public key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
