// Service Worker for Web Push Notifications
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('Push notification received but no data');
    return;
  }

  try {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon.png',
      badge: '/icon.png',
      tag: 'notification',
      requireInteraction: false,
      ...(data.image && { image: data.image }),
      data: data.data || {},
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Notification', options)
    );
  } catch (error) {
    console.error('Error handling push notification:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Handle click - open app or focus existing window
  const deepLink = event.notification.data?.deepLink;
  const urlToOpen = deepLink ? new URL(deepLink, self.location.origin).href : self.location.origin;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        if (windowClients[i].url === urlToOpen) {
          return windowClients[i].focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
