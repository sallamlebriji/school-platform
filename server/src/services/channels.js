'use strict';
/**
 * Adaptateurs d'envoi externes. Chacun renvoie { status, provider, destination, error? }.
 *
 *  email : SMTP (nodemailer). Sans SMTP_HOST → fichiers .eml dans server/outbox/.
 *  sms   : SMS_PROVIDER = log | twilio | http (fournisseur local exposant une API JSON).
 *  push  : Web Push (VAPID) vers les navigateurs abonnés. Sans clés → ignoré.
 */
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const webpush = require('web-push');
const config = require('../config/env');
const { PushSubscription } = require('../models');

// ---------------------------------------------------------------- EMAIL
const smtp = config.mail.host
  ? nodemailer.createTransport({ host: config.mail.host, port: config.mail.port, secure: config.mail.port === 465, auth: config.mail.user ? { user: config.mail.user, pass: config.mail.password } : undefined })
  : nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function emailHtml(tenant, n) {
  const color = tenant.primaryColor || '#13254A';
  const link = n.link ? `${config.clientUrl}${n.link}` : config.clientUrl;
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#FBF9F4;font-family:Segoe UI,Arial,sans-serif;color:#111C33">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #E9E4DA;border-radius:16px;overflow:hidden">
    <tr><td style="background:${color};padding:20px 28px;color:#fff;font-size:17px;font-family:Georgia,serif">${esc(tenant.name)}</td></tr>
    <tr><td style="padding:28px">
      <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-weight:500;font-size:22px">${esc(n.title)}</h1>
      ${n.body ? `<p style="margin:0 0 22px;line-height:1.6;color:#4A556E">${esc(n.body)}</p>` : ''}
      <a href="${esc(link)}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600">Ouvrir mon espace</a>
    </td></tr>
    <tr><td style="padding:16px 28px;border-top:1px solid #E9E4DA;font-size:12px;color:#8B93A7">Vous recevez ce message car vous êtes inscrit(e) sur l'espace ${esc(tenant.name)}. Gérez vos préférences de notification depuis votre profil.</td></tr>
  </table></td></tr></table></body></html>`;
}

async function sendEmail(tenant, user, n) {
  if (!user.email) return { status: 'skipped', provider: 'none', error: 'Adresse email absente' };
  const info = await smtp.sendMail({ from: config.mail.from, to: user.email, subject: `${n.title} — ${tenant.name}`, text: `${n.title}\n\n${n.body || ''}\n\n${config.clientUrl}${n.link || ''}`, html: emailHtml(tenant, n) });
  if (config.mail.host) return { status: 'sent', provider: 'smtp', destination: user.email };
  // Mode développement : le message complet est écrit dans outbox/<école>/
  const dir = path.join(config.mail.outboxDir, tenant.slug);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${user.id}.eml`);
  fs.writeFileSync(file, info.message);
  return { status: 'sent', provider: 'outbox', destination: user.email };
}

// ---------------------------------------------------------------- SMS
const normalizePhone = p => {
  if (!p) return null;
  let s = String(p).replace(/[^\d+]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (s.startsWith('0')) s = '+212' + s.slice(1); // numéro marocain national
  return /^\+\d{8,15}$/.test(s) ? s : null;
};

async function sendSms(tenant, user, n) {
  const to = normalizePhone(user.phone);
  if (!to) return { status: 'skipped', provider: config.sms.provider, error: 'Numéro de téléphone absent ou invalide' };
  const text = `${tenant.name}: ${n.title}${n.body ? ' ' + n.body : ''}`.slice(0, 300);
  if (config.sms.provider === 'twilio') {
    const { sid, token, from } = config.sms.twilio;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: from, Body: text }),
    });
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return { status: 'sent', provider: 'twilio', destination: to };
  }
  if (config.sms.provider === 'http') {
    const res = await fetch(config.sms.http.url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.sms.http.token}` }, body: JSON.stringify({ to, message: text, sender: tenant.name.slice(0, 11) }) });
    if (!res.ok) throw new Error(`Fournisseur SMS ${res.status}`);
    return { status: 'sent', provider: 'http', destination: to };
  }
  console.log(`[sms] → ${to} : ${text}`);
  return { status: 'skipped', provider: 'log', destination: to, error: 'SMS_PROVIDER=log (aucun envoi réel)' };
}

// ---------------------------------------------------------------- PUSH
const pushEnabled = !!(config.push.publicKey && config.push.privateKey);
if (pushEnabled) webpush.setVapidDetails(config.push.subject, config.push.publicKey, config.push.privateKey);

async function sendPush(tenant, user, n) {
  if (!pushEnabled) return { status: 'skipped', provider: 'webpush', error: 'Clés VAPID non configurées' };
  const subs = await PushSubscription.findAll({ where: { userId: user.id } });
  if (!subs.length) return { status: 'skipped', provider: 'webpush', error: 'Aucun navigateur abonné' };
  const payload = JSON.stringify({ title: n.title, body: n.body || '', url: n.link || '/', tag: n.kind, school: tenant.name });
  let sent = 0;
  for (const s of subs) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 }); sent++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await s.destroy(); else throw e; } // abonnement expiré → supprimé
  }
  return sent ? { status: 'sent', provider: 'webpush', destination: `${sent} appareil(s)` } : { status: 'skipped', provider: 'webpush', error: 'Abonnements expirés' };
}

module.exports = { email: sendEmail, sms: sendSms, push: sendPush, pushEnabled, normalizePhone, emailHtml };
