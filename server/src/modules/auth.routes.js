'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { authenticator } = require('otplib');
const config = require('../config/env');
const { ROLE_PERMISSIONS } = require('../config/permissions');
const { User, Session, Guardian, StudentGuardian, Student, Class, Teacher, Subject } = require('../models');
const { authenticate } = require('../middlewares/auth');
const { validate } = require('../middlewares/common');
const { asyncHandler, unauthorized, badRequest } = require('../core/errors');
const { signAccess, newRefreshToken, sha256 } = require('../services/security');

const router = express.Router();
const MAX_FAILED = 5, LOCK_MINUTES = 15;
const COOKIE = 'athenee_rt';

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Trop de tentatives, réessayez plus tard' } });

const { DEFAULT_PREFS } = require('../services/notifier');
const publicUser = u => ({ id: u.id, role: u.role, email: u.email, firstName: u.firstName, lastName: u.lastName, phone: u.phone, totpEnabled: u.totpEnabled, locale: u.locale || 'fr', notifyPrefs: { ...DEFAULT_PREFS, ...(u.notifyPrefs || {}) } });
const publicTenant = t => ({ id: t.id, slug: t.slug, name: t.name, city: t.city, currency: t.currency, primaryColor: t.primaryColor, logoUrl: t.logoUrl, schoolYear: t.schoolYear, plan: t.plan && { id: t.plan.id, name: t.plan.name, features: t.plan.features, maxStudents: t.plan.maxStudents } });

async function openSession(req, res, user) {
  const refresh = newRefreshToken();
  await Session.create({
    userId: user.id, refreshHash: sha256(refresh), userAgent: (req.get('User-Agent') || '').slice(0, 255), ip: req.ip,
    expiresAt: new Date(Date.now() + config.jwt.refreshDays * 86400000),
  });
  res.cookie(COOKIE, refresh, { httpOnly: true, secure: config.isProd, sameSite: 'lax', path: '/api/auth', maxAge: config.jwt.refreshDays * 86400000 });
  return signAccess(user);
}

router.post('/login', loginLimiter, validate({ body: z.object({ email: z.string().email(), password: z.string().min(1), code: z.string().optional() }) }), asyncHandler(async (req, res) => {
  const user = await User.scope('withSecrets').findOne({ where: { email: req.body.email.toLowerCase() } });
  const fail = () => unauthorized('Email ou mot de passe incorrect');
  if (!user || !user.passwordHash || user.status !== 'active') throw fail();
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) throw unauthorized('Compte temporairement verrouillé suite à plusieurs échecs');

  if (!(await bcrypt.compare(req.body.password, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    await user.update({ failedLogins: failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60000) : null });
    throw fail();
  }
  if (user.totpEnabled) {
    if (!req.body.code) return res.json({ twoFactorRequired: true });
    if (!authenticator.check(req.body.code, user.totpSecret)) throw unauthorized('Code de vérification invalide');
  }
  await user.update({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() });
  const accessToken = await openSession(req, res, user);
  res.json({ accessToken, user: publicUser(user), tenant: publicTenant(req.tenant) });
}));

/** Rotation du refresh token : l'ancien est révoqué à chaque usage. */
router.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.cookies[COOKIE];
  if (!token) throw unauthorized();
  const session = await Session.findOne({ where: { refreshHash: sha256(token) } });
  if (!session || session.revokedAt || new Date(session.expiresAt) < new Date()) throw unauthorized('Session expirée');
  const user = await User.findByPk(session.userId);
  if (!user || user.status !== 'active') throw unauthorized();
  await session.update({ revokedAt: new Date() });
  const accessToken = await openSession(req, res, user);
  res.json({ accessToken, user: publicUser(user), tenant: publicTenant(req.tenant) });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const token = req.cookies[COOKIE];
  if (token) await Session.update({ revokedAt: new Date() }, { where: { refreshHash: sha256(token) } });
  res.clearCookie(COOKIE, { path: '/api/auth' });
  res.status(204).end();
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const u = req.user;
  const extra = {};
  if (u.role === 'parent') {
    const g = await Guardian.findOne({ where: { userId: u.id }, include: [{ model: StudentGuardian, as: 'childLinks', include: [{ model: Student, as: 'student', include: [{ model: Class, as: 'class', attributes: ['id', 'name'] }] }] }] });
    extra.children = g ? g.childLinks.map(l => l.student) : [];
  }
  if (u.role === 'student') extra.student = await Student.findOne({ where: { userId: u.id }, include: [{ model: Class, as: 'class', attributes: ['id', 'name'] }] });
  if (u.role === 'teacher') extra.teacher = await Teacher.findOne({ where: { userId: u.id }, include: [{ model: Subject, as: 'subject' }] });
  res.json({ user: publicUser(u), tenant: publicTenant(req.tenant), permissions: ROLE_PERMISSIONS[u.role], ...extra });
}));

router.get('/sessions', authenticate, asyncHandler(async (req, res) => {
  res.json(await Session.findAll({ where: { userId: req.user.id, revokedAt: null }, attributes: ['id', 'userAgent', 'ip', 'createdAt', 'expiresAt'], order: [['id', 'DESC']] }));
}));
router.delete('/sessions/:id', authenticate, asyncHandler(async (req, res) => {
  await Session.update({ revokedAt: new Date() }, { where: { id: req.params.id, userId: req.user.id } });
  res.status(204).end();
}));

// ---------- 2FA (TOTP : Google Authenticator, Authy…) ----------
router.post('/2fa/setup', authenticate, asyncHandler(async (req, res) => {
  const secret = authenticator.generateSecret();
  await User.update({ totpSecret: secret, totpEnabled: false }, { where: { id: req.user.id } });
  res.json({ secret, otpauthUrl: authenticator.keyuri(req.user.email, `Athénée · ${req.tenant.name}`, secret) });
}));
router.post('/2fa/enable', authenticate, validate({ body: z.object({ code: z.string().length(6) }) }), asyncHandler(async (req, res) => {
  const u = await User.scope('withSecrets').findByPk(req.user.id);
  if (!u.totpSecret || !authenticator.check(req.body.code, u.totpSecret)) throw badRequest('Code invalide');
  await u.update({ totpEnabled: true });
  res.json({ totpEnabled: true });
}));

router.patch('/me/preferences', authenticate, validate({ body: z.object({
  locale: z.enum(['fr', 'ar', 'en']).optional(),
  notifyPrefs: z.object({ email: z.boolean(), push: z.boolean(), sms: z.boolean() }).partial().optional(),
  phone: z.string().max(30).optional(),
}) }), asyncHandler(async (req, res) => {
  const u = await User.findByPk(req.user.id);
  const patch = { ...req.body };
  if (patch.notifyPrefs) patch.notifyPrefs = { ...DEFAULT_PREFS, ...(u.notifyPrefs || {}), ...patch.notifyPrefs };
  await u.update(patch);
  res.json({ user: publicUser(u) });
}));

router.patch('/me/password', authenticate, validate({ body: z.object({ current: z.string(), next: z.string().min(10, '10 caractères minimum') }) }), asyncHandler(async (req, res) => {
  const u = await User.scope('withSecrets').findByPk(req.user.id);
  if (!(await bcrypt.compare(req.body.current, u.passwordHash))) throw badRequest('Mot de passe actuel incorrect');
  await u.update({ passwordHash: await bcrypt.hash(req.body.next, 12) });
  await Session.update({ revokedAt: new Date() }, { where: { userId: u.id, revokedAt: null } });
  res.json({ ok: true });
}));

module.exports = router;
