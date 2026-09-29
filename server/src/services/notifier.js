'use strict';
/**
 * Notifications multi-canal.
 *  1. In-app : ligne dans `notifications` + événement Socket.IO (immédiat).
 *  2. Canaux externes demandés (email, push, sms) : envoyés en arrière-plan,
 *     selon les préférences de chaque utilisateur, et tracés dans
 *     `notification_deliveries` (envoyé / ignoré / échec).
 */
const { Op } = require('sequelize');
const { Notification, NotificationDelivery, Guardian, StudentGuardian, User } = require('../models');
const { currentTenantId, ctx } = require('../core/context');
const realtime = require('./realtime');
const channels = require('./channels');

const DEFAULT_PREFS = { email: true, push: true, sms: true };
const prefsOf = u => ({ ...DEFAULT_PREFS, ...(u.notifyPrefs || {}) });

/**
 * @param {number[]} userIds
 * @param {{kind:string,title:string,body?:string,link?:string}} n
 * @param {{channels?: ('email'|'push'|'sms')[], wait?: boolean}} opts
 *        wait=true : attend la fin des envois (tests, tâches planifiées)
 */
async function notify(userIds, n, opts = {}) {
  const ids = [...new Set(userIds.filter(Boolean).map(Number))];
  if (!ids.length) return 0;
  const tenantId = currentTenantId();
  const tenant = ctx().tenant;
  const rows = await Notification.bulkCreate(ids.map(userId => ({ userId, kind: n.kind, title: n.title, body: n.body, link: n.link })));
  rows.forEach(r => realtime.toUser(tenantId, r.userId, 'notification', r.get({ plain: true })));

  const wanted = (opts.channels || []).filter(c => channels[c]);
  if (wanted.length) {
    const job = deliver(tenant, rows, ids, n, wanted).catch(e => console.error('[notifier]', e.message));
    if (opts.wait) await job;
  }
  return rows.length;
}

async function deliver(tenant, rows, ids, n, wanted) {
  const users = await User.findAll({ where: { id: { [Op.in]: ids }, status: { [Op.ne]: 'disabled' } } });
  const log = [];
  for (const u of users) {
    const prefs = prefsOf(u);
    const notificationId = (rows.find(r => Number(r.userId) === Number(u.id)) || {}).id;
    for (const channel of wanted) {
      let result;
      if (!prefs[channel]) result = { status: 'skipped', provider: 'prefs', error: 'Canal désactivé par l\'utilisateur' };
      else {
        try { result = await channels[channel](tenant, u, n); }
        catch (e) { result = { status: 'failed', provider: channel, error: String(e.message).slice(0, 500) }; }
      }
      log.push({ notificationId, userId: u.id, channel, ...result });
    }
  }
  if (log.length) await NotificationDelivery.bulkCreate(log);
  return log;
}

async function parentUserIds(studentIds) {
  if (!studentIds.length) return [];
  const links = await StudentGuardian.findAll({ where: { studentId: { [Op.in]: studentIds } }, include: [{ model: Guardian, as: 'guardian', attributes: ['userId'] }] });
  return links.map(l => l.guardian && l.guardian.userId).filter(Boolean);
}

/** Map studentId -> [userId parents] */
async function parentsByStudent(studentIds) {
  const map = {};
  if (!studentIds.length) return map;
  const links = await StudentGuardian.findAll({ where: { studentId: { [Op.in]: studentIds } }, include: [{ model: Guardian, as: 'guardian', attributes: ['userId'] }] });
  links.forEach(l => { if (l.guardian && l.guardian.userId) (map[l.studentId] = map[l.studentId] || []).push(l.guardian.userId); });
  return map;
}

module.exports = { notify, parentUserIds, parentsByStudent, DEFAULT_PREFS };
