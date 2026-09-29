import { api } from '../api/client';

/** Abonnement du navigateur aux notifications push (Web Push, clés VAPID du serveur). */
const toUint8 = base64 => {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
};

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function pushStatus() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = reg && (await reg.pushManager.getSubscription());
  return sub ? 'on' : 'off';
}

export async function enablePush() {
  const { data } = await api.get('/push/public-key');
  if (!data.enabled) return 'disabled';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8(data.publicKey) }));
  await api.post('/push/subscribe', sub.toJSON());
  await api.post('/push/test');
  return 'on';
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = reg && (await reg.pushManager.getSubscription());
  if (sub) { await api.delete('/push/subscribe', { data: { endpoint: sub.endpoint } }).catch(() => {}); await sub.unsubscribe(); }
  return 'off';
}
