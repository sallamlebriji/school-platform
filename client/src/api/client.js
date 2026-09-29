import axios from 'axios';

/**
 * Client HTTP de l'API.
 *  - le jeton d'accès vit en mémoire (jamais dans localStorage) ;
 *  - le refresh token est un cookie httpOnly géré par le navigateur ;
 *  - en développement, l'établissement est transmis par l'en-tête X-Tenant
 *    (en production il est déduit du sous-domaine : alfarabi.athenee.app).
 */
let accessToken = null;
let onLogout = () => {};

export const setAccessToken = t => { accessToken = t; };
export const getAccessToken = () => accessToken;
export const setLogoutHandler = fn => { onLogout = fn; };
export const getTenantSlug = () => localStorage.getItem('athenee.tenant') || 'alfarabi';
export const setTenantSlug = s => localStorage.setItem('athenee.tenant', s);

export const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.request.use(cfg => {
  cfg.headers['X-Tenant'] = getTenantSlug();
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});

let refreshing = null;
api.interceptors.response.use(
  r => r,
  async err => {
    const original = err.config;
    if (err.response && err.response.status === 401 && !original._retry && !original.url.startsWith('/auth/')) {
      original._retry = true;
      try {
        refreshing = refreshing || api.post('/auth/refresh').finally(() => { refreshing = null; });
        const { data } = await refreshing;
        setAccessToken(data.accessToken);
        return api(original);
      } catch {
        setAccessToken(null);
        onLogout();
      }
    }
    return Promise.reject(err);
  }
);

export const errorMessage = e => (e && e.response && e.response.data && e.response.data.error) || e.message || 'Erreur';

/** Ouvre un PDF protégé (le jeton est envoyé via l'en-tête, pas dans l'URL). */
export async function openPdf(path) {
  const res = await api.get(path, { responseType: 'blob' });
  window.open(URL.createObjectURL(res.data), '_blank');
}
