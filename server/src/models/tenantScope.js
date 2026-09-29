'use strict';
/**
 * Isolation multi-tenant au niveau ORM.
 *
 * MySQL n'offre pas de Row-Level Security : on l'implémente avec des hooks
 * Sequelize posés sur CHAQUE modèle possédant `tenantId`.
 *   - lectures (find, count, include…) : ajout forcé de `tenant_id = <tenant courant>`
 *   - écritures en masse (update/destroy) : même filtre
 *   - créations : `tenant_id` imposé depuis le contexte (jamais depuis le client)
 *   - écritures d'instance : refus si l'instance appartient à un autre tenant
 * Hors contexte tenant, toute requête est REFUSÉE (fail-closed), sauf en mode
 * système explicite (runAsSystem) réservé au seed et aux tâches plateforme.
 *
 * En complément, les clés étrangères composites (tenant_id, xxx_id) du schéma
 * garantissent qu'aucune ligne ne peut référencer une ligne d'un autre tenant.
 */
const { Op } = require('sequelize');
const { currentTenantId, isSystem } = require('../core/context');

function tenantIdOrThrow(modelName) {
  const tid = currentTenantId();
  if (tid) return tid;
  if (isSystem()) return null;
  throw new Error(`[tenant] Accès à ${modelName} hors contexte tenant refusé`);
}

function andWhere(options, extra) {
  options.where = options.where ? { [Op.and]: [options.where, extra] } : extra;
}

function scopeIncludes(includes, tid) {
  for (const inc of includes || []) {
    if (inc.model && inc.model.rawAttributes.tenantId) {
      if (inc.required === undefined) inc.required = !!inc.where; // conserve la sémantique LEFT JOIN
      andWhere(inc, { tenantId: tid });
    }
    if (inc.include) scopeIncludes(inc.include, tid);
  }
}

function applyTenantScope(Model) {
  const name = Model.name;

  Model.addHook('beforeFind', 'tenant', options => {
    const tid = tenantIdOrThrow(name);
    if (tid) andWhere(options, { tenantId: tid });
  });
  Model.addHook('beforeFindAfterExpandIncludeAll', 'tenantIncludes', options => {
    const tid = tenantIdOrThrow(name);
    if (tid) scopeIncludes(options.include, tid);
  });
  Model.addHook('beforeCount', 'tenant', options => {
    const tid = tenantIdOrThrow(name);
    if (tid) andWhere(options, { tenantId: tid });
  });
  for (const hook of ['beforeBulkUpdate', 'beforeBulkDestroy']) {
    Model.addHook(hook, 'tenant', options => {
      const tid = tenantIdOrThrow(name);
      if (tid) andWhere(options, { tenantId: tid });
    });
  }

  const stamp = instance => {
    const tid = tenantIdOrThrow(name);
    if (!tid) { if (!instance.tenantId) throw new Error(`[tenant] ${name} créé sans tenantId`); return; }
    if (instance.tenantId && Number(instance.tenantId) !== Number(tid)) throw new Error(`[tenant] ${name} : tenantId incohérent`);
    instance.tenantId = tid;
  };
  Model.addHook('beforeValidate', 'tenant', (instance, options) => { if (instance.isNewRecord) stamp(instance); });
  Model.addHook('beforeCreate', 'tenant', stamp);
  Model.addHook('beforeBulkCreate', 'tenant', instances => instances.forEach(stamp));
  Model.addHook('beforeUpsert', 'tenant', values => {
    const tid = tenantIdOrThrow(name);
    if (tid) values.tenantId = tid;
  });

  const guard = instance => {
    const tid = tenantIdOrThrow(name);
    if (tid && Number(instance.tenantId) !== Number(tid)) throw new Error(`[tenant] ${name} appartient à un autre tenant`);
  };
  Model.addHook('beforeUpdate', 'tenant', guard);
  Model.addHook('beforeDestroy', 'tenant', guard);
}

module.exports = { applyTenantScope };
