import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { api, setAccessToken, getAccessToken, setLogoutHandler, setTenantSlug } from '../api/client';
import { useI18n } from '../i18n';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null); // { user, tenant, permissions, children?, teacher?, student? }
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [unread, setUnread] = useState(0);
  const { lang, setLang } = useI18n();

  const loadMe = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    setSession(data);
    document.documentElement.style.setProperty('--accent', data.tenant.primaryColor);
    if (data.user.locale) setLang(data.user.locale); // langue mémorisée dans le profil
    return data;
  }, [setLang]);

  // Restauration de session au chargement via le cookie de refresh
  useEffect(() => {
    api.post('/auth/refresh').then(({ data }) => { setAccessToken(data.accessToken); return loadMe(); }).catch(() => {}).finally(() => setLoading(false));
  }, [loadMe]);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    setAccessToken(null); setSession(null);
  }, []);
  useEffect(() => setLogoutHandler(() => { setSession(null); }), []);

  // Temps réel : notifications
  useEffect(() => {
    if (!session) return undefined;
    api.get('/notifications').then(r => setUnread(r.data.unread)).catch(() => {});
    const s = io(import.meta.env.VITE_API_URL || undefined, { auth: { token: getAccessToken() } });
    s.on('notification', () => setUnread(n => n + 1));
    setSocket(s);
    return () => s.disconnect();
  }, [session]);

  const login = useCallback(async (tenant, email, password, code) => {
    setTenantSlug(tenant);
    const { data } = await api.post('/auth/login', { email, password, code });
    if (data.twoFactorRequired) return { twoFactorRequired: true };
    setAccessToken(data.accessToken);
    // La langue choisie sur l'écran de connexion devient celle du profil
    if (data.user.locale !== lang) await api.patch('/auth/me/preferences', { locale: lang }).catch(() => {});
    await loadMe();
    return { ok: true };
  }, [loadMe, lang]);

  const can = useCallback(perm => {
    const perms = (session && session.permissions) || [];
    const [res] = perm.split(':');
    return perms.includes('*') || perms.includes(perm) || perms.includes(`${res}:*`);
  }, [session]);

  const value = useMemo(() => ({ session, loading, login, logout, can, socket, unread, setUnread, reload: loadMe }), [session, loading, login, logout, can, socket, unread, loadMe]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
