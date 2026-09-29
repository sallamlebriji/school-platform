/* Service worker Athénée — réception des notifications push (Web Push / VAPID). */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Athénée', {
    body: data.body || '',
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
    lang: 'fr',
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data.url || '/', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.startsWith(self.location.origin));
    if (open) { open.navigate(url); return open.focus(); }
    return clients.openWindow(url);
  }));
});
