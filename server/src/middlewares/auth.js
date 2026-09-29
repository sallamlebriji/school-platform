'use strict';
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { can } = require('../config/permissions');
const { User } = require('../models');
const { ctx } = require('../core/context');
const { unauthorized, forbidden } = require('../core/errors');

/** Vérifie le JWT d'accès et attache l'utilisateur au contexte. */
async function authenticate(req, res, next) {
  try {
    const header = req.get('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw unauthorized();
    let payload;
    try { payload = jwt.verify(token, config.jwt.accessSecret); } catch { throw unauthorized('Session expirée'); }
    // Un jeton émis pour l'école A ne fonctionne jamais sur l'école B.
    if (Number(payload.tid) !== Number(req.tenant.id)) throw forbidden('Jeton non valable pour cet établissement');
    const user = await User.findByPk(payload.sub);
    if (!user || user.status !== 'active') throw unauthorized('Compte inactif');
    req.user = user;
    ctx().user = user;
    next();
  } catch (e) { next(e); }
}

/** Exige au moins une des permissions listées. */
const requirePerm = (...perms) => (req, res, next) => {
  if (!req.user) return next(unauthorized());
  if (perms.some(p => can(req.user.role, p))) return next();
  next(forbidden(`Permission requise : ${perms.join(' ou ')}`));
};

const requireRole = (...roles) => (req, res, next) =>
  req.user && roles.includes(req.user.role) ? next() : next(forbidden());

module.exports = { authenticate, requirePerm, requireRole };
