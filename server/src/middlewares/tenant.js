'use strict';
/**
 * Résolution du tenant pour chaque requête :
 *   1. domaine personnalisé   (ecole-lumiere.ma)
 *   2. sous-domaine           (alfarabi.athenee.app)
 *   3. en-tête X-Tenant       (développement uniquement)
 * Le reste de la requête s'exécute ensuite dans le contexte de ce tenant.
 */
const config = require('../config/env');
const { Tenant, Plan } = require('../models');
const { als } = require('../core/context');
const { HttpError } = require('../core/errors');

const cache = new Map(); // clé -> { tenant, at }
const TTL = 60_000;

async function findTenant(key, by) {
  const hit = cache.get(by + key);
  if (hit && Date.now() - hit.at < TTL) return hit.tenant;
  const tenant = await Tenant.findOne({ where: { [by]: key }, include: [{ model: Plan, as: 'plan' }] });
  if (tenant) cache.set(by + key, { tenant: tenant.get({ plain: true }), at: Date.now() });
  return tenant ? tenant.get({ plain: true }) : null;
}

function invalidateTenantCache() { cache.clear(); }

async function resolveTenant(req, res, next) {
  try {
    const host = (req.hostname || '').toLowerCase();
    let tenant = null;
    if (host && !['localhost', '127.0.0.1'].includes(host)) {
      tenant = await findTenant(host, 'customDomain');
      if (!tenant && host.endsWith('.' + config.rootDomain)) tenant = await findTenant(host.slice(0, -(config.rootDomain.length + 1)), 'slug');
    }
    if (!tenant && config.allowTenantHeader && req.get('X-Tenant')) tenant = await findTenant(req.get('X-Tenant'), 'slug');
    if (!tenant) throw new HttpError(404, 'Établissement introuvable');
    if (tenant.status !== 'active') throw new HttpError(403, 'Établissement suspendu');
    req.tenant = tenant;
    als.run({ tenant, tenantId: tenant.id, user: null }, next);
  } catch (e) { next(e); }
}

/** Vérifie qu'une fonctionnalité est incluse dans le plan de l'école. */
const requireFeature = feature => (req, res, next) => {
  const features = (req.tenant.plan && req.tenant.plan.features) || {};
  if (!features[feature]) return next(new HttpError(402, `Fonctionnalité « ${feature} » non incluse dans votre abonnement`));
  next();
};

module.exports = { resolveTenant, requireFeature, invalidateTenantCache };
