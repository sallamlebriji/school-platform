import { Platform } from 'react-native';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000')).replace(/\/$/, '');
let token: string | null = null;
let tenant = 'alfarabi';
let refreshing: Promise<void> | null = null;
let expired = () => {};
export const configureSession = (slug: string, accessToken: string | null) => { tenant = slug; token = accessToken; };
export const onSessionExpired = (callback: () => void) => { expired = callback; };

export async function request<T = any>(path: string, method = 'GET', body?: unknown, retry = true): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method, credentials: 'include', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-Tenant': tenant, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error(`Connexion impossible à ${API_URL}. Vérifiez que le téléphone et le serveur sont sur le même réseau et que l’API est démarrée.`);
  } finally { clearTimeout(timeout); }
  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    try {
      refreshing ??= request('/auth/refresh', 'POST', undefined, false).then(data => { token = data.accessToken; }).finally(() => { refreshing = null; });
      await refreshing;
    } catch { token = null; expired(); throw new Error('Session expirée. Reconnectez-vous.'); }
    return request<T>(path, method, body, false);
  }
  const data = response.status === 204 ? null : await response.json();
  if (response.status === 401 && !path.startsWith('/auth/')) { token = null; expired(); }
  if (!response.ok) throw new Error(data?.error || `Erreur ${response.status}`);
  return data as T;
}
