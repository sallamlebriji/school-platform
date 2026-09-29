'use strict';
/**
 * Contexte de requête (AsyncLocalStorage).
 * Porte le tenant et l'utilisateur courant jusqu'à la couche d'accès aux
 * données, sans avoir à les passer de fonction en fonction. C'est ce qui
 * permet à Sequelize d'ajouter automatiquement `tenant_id = ?` partout.
 */
const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();

/** Exécute fn dans le contexte d'un tenant. */
const runWithTenant = (tenant, fn) => als.run({ tenant, tenantId: tenant.id, user: null }, fn);

/** Exécute fn hors tenant (seed, résolution du domaine, tâches plateforme). */
const runAsSystem = fn => als.run({ system: true }, fn);

const ctx = () => als.getStore();
const currentTenantId = () => { const s = als.getStore(); return s && s.tenantId; };
const currentUser = () => { const s = als.getStore(); return s && s.user; };
const isSystem = () => { const s = als.getStore(); return !!(s && s.system); };

module.exports = { als, runWithTenant, runAsSystem, ctx, currentTenantId, currentUser, isSystem };
