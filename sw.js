const CACHE_NAME = 'kuehlschrank-v1';
const ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});

// Push-Benachrichtigung empfangen
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'Kühlschrank', body: 'Prüfe deine Produkte!' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'mhd-reminder',
      renotify: true,
      actions: [{ action: 'open', title: 'App öffnen' }]
    })
  );
});

// Notification-Klick → App öffnen
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('./');
    })
  );
});

// Täglicher MHD-Check (via Background Sync / periodischer Alarm-Trick)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'CHECK_MHD') {
    checkAndNotify(e.data.products);
  }
});

function checkAndNotify(products) {
  if (!products || !products.length) return;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const soon = products.filter(p => {
    const mhd = new Date(p.mhd); mhd.setHours(0, 0, 0, 0);
    const days = Math.round((mhd - today) / 86400000);
    return days >= 0 && days <= 2;
  });
  const expired = products.filter(p => {
    const mhd = new Date(p.mhd); mhd.setHours(0, 0, 0, 0);
    return Math.round((mhd - today) / 86400000) < 0;
  });
  if (soon.length > 0 || expired.length > 0) {
    let body = '';
    if (expired.length) body += `⚠️ Abgelaufen: ${expired.map(p => p.name).join(', ')}. `;
    if (soon.length) body += `🕐 Läuft bald ab: ${soon.map(p => p.name).join(', ')}.`;
    self.registration.showNotification('🥛 Kühlschrank-Reminder', {
      body: body.trim(),
      icon: './icon-192.png',
      tag: 'mhd-reminder',
      renotify: true
    });
  }
}
