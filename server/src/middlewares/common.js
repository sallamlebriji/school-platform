'use strict';
const { ZodError } = require('zod');
const { UniqueConstraintError, ForeignKeyConstraintError, ValidationError, DatabaseError } = require('sequelize');
const { AuditLog } = require('../models');
const { runWithTenant } = require('../core/context');
const { HttpError, badRequest } = require('../core/errors');
const config = require('../config/env');

/** Validation zod de body / query / params. Les valeurs validées remplacent les brutes. */
const validate = schemas => (req, res, next) => {
  try {
    for (const key of ['body', 'query', 'params']) {
      if (schemas[key]) {
        const parsed = schemas[key].parse(req[key]);
        if (key === 'query') req.validQuery = parsed; else req[key] = parsed;
      }
    }
    next();
  } catch (e) { next(e); }
};

/** Journal d'audit : toute requête d'écriture authentifiée est tracée. */
function audit(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const started = Date.now();
  res.on('finish', () => {
    if (!req.tenant || res.statusCode >= 500) return;
    const tenant = req.tenant, user = req.user;
    runWithTenant(tenant, () => AuditLog.create({
      userId: user ? user.id : null,
      action: `${req.method} ${req.baseUrl}${req.route ? req.route.path : ''}`,
      entity: (req.baseUrl || '').split('/').pop() || null,
      entityId: req.params && req.params.id ? String(req.params.id) : null,
      method: req.method, path: req.originalUrl.slice(0, 255), statusCode: res.statusCode,
      ip: req.ip, meta: { ms: Date.now() - started },
    })).catch(err => console.error('[audit]', err.message));
  });
  next();
}

/** Trace explicite d'un accès sensible en lecture (ex. dossier médical). */
function auditRead(req, action, entity, entityId) {
  return AuditLog.create({ userId: req.user && req.user.id, action, entity, entityId: String(entityId), method: 'GET', path: req.originalUrl.slice(0, 255), statusCode: 200, ip: req.ip });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) err = badRequest('Données invalides', err.issues.map(i => ({ path: i.path.join('.'), message: i.message })));
  else if (err instanceof UniqueConstraintError) err = new HttpError(409, 'Cet enregistrement existe déjà', err.errors && err.errors.map(e => e.path));
  else if (err instanceof ForeignKeyConstraintError) err = badRequest('Référence invalide (élément inexistant dans cet établissement)');
  else if (err instanceof ValidationError) err = badRequest(err.message);
  else if (err instanceof DatabaseError && /CONSTRAINT|CHECK/i.test(err.message)) err = badRequest('Valeur refusée par la base de données');

  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 && config.isProd ? 'Erreur interne' : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
}

module.exports = { validate, audit, auditRead, errorHandler };
