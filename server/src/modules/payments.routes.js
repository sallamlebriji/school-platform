'use strict';
/**
 * Paiement en ligne :
 *   POST /finance/invoices/:id/checkout      → crée une session et renvoie l'URL de paiement
 *   GET  /finance/checkout/:id               → statut (page de retour)
 *   POST /finance/checkout/:id/simulate      → confirme un paiement simulé (dev uniquement)
 *   POST /webhooks/stripe                    → confirmation serveur Stripe (hors tenant, signé)
 */
const express = require('express');
const { z } = require('zod');
const config = require('../config/env');
const M = require('../models');
const { requirePerm } = require('../middlewares/auth');
const { validate } = require('../middlewares/common');
const { idParam } = require('../core/crud');
const { asyncHandler, notFound, forbidden, badRequest } = require('../core/errors');
const { runAsSystem, runWithTenant } = require('../core/context');
const scope = require('../services/scope');
const payments = require('../services/payments');

const r = express.Router();

r.post('/finance/invoices/:id/checkout', requirePerm('finance:pay', 'finance:write'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const invoice = await M.Invoice.findByPk(req.params.id, { include: [{ model: M.Student, as: 'student' }] });
  if (!invoice) throw notFound();
  await scope.assertStudentAccess(req.user, invoice.studentId);
  const ps = await payments.createCheckout({ invoice, student: invoice.student, tenant: req.tenant, user: req.user });
  res.status(201).json({ sessionId: ps.id, provider: ps.provider, url: ps.checkoutUrl });
}));

const loadSession = async (req) => {
  const ps = await M.PaymentSession.findByPk(req.params.id, { include: [{ model: M.Invoice, as: 'invoice', include: [{ model: M.Student, as: 'student', attributes: ['id', 'firstName', 'lastName'] }] }] });
  if (!ps) throw notFound();
  await scope.assertStudentAccess(req.user, ps.invoice.studentId);
  return ps;
};

r.get('/finance/checkout/:id', requirePerm('finance:read'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const ps = await loadSession(req);
  res.json({ id: ps.id, status: ps.status, provider: ps.provider, amountCents: ps.amountCents, invoice: { id: ps.invoice.id, number: ps.invoice.number, label: ps.invoice.label, status: ps.invoice.status, student: ps.invoice.student } });
}));

r.post('/finance/checkout/:id/simulate', requirePerm('finance:pay', 'finance:write'), validate({ params: idParam, body: z.object({ outcome: z.enum(['paid', 'failed']) }) }), asyncHandler(async (req, res) => {
  if (config.isProd) throw forbidden();
  const ps = await loadSession(req);
  if (ps.provider !== 'simulated') throw badRequest('Session non simulée');
  if (Number(ps.createdBy) !== Number(req.user.id)) throw forbidden();
  if (req.body.outcome === 'paid') await payments.completePayment(ps); else await payments.failPayment(ps);
  res.json({ status: (await ps.reload()).status });
}));

/** Webhook Stripe — monté AVANT express.json (corps brut requis pour la signature). */
const webhook = express.Router();
webhook.post('/stripe', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  let event;
  try { event = payments.parseStripeEvent(req.body, req.get('stripe-signature')); }
  catch (e) { return res.status(400).send(`Signature invalide : ${e.message}`); }
  try {
    const obj = event.data.object;
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired', 'checkout.session.async_payment_failed'].includes(event.type)) {
      const ps = await runAsSystem(() => M.PaymentSession.findOne({ where: { provider: 'stripe', providerSessionId: obj.id } }));
      if (!ps) return res.json({ ignored: true });
      const tenant = await runAsSystem(() => M.Tenant.findByPk(ps.tenantId));
      await runWithTenant(tenant.get({ plain: true }), async () => {
        const fresh = await M.PaymentSession.findByPk(ps.id);
        if (event.type.endsWith('succeeded') || (event.type === 'checkout.session.completed' && obj.payment_status === 'paid')) await payments.completePayment(fresh, obj.payment_intent);
        else if (event.type.endsWith('expired') || event.type.endsWith('failed')) await payments.failPayment(fresh);
      });
    }
    res.json({ received: true });
  } catch (e) {
    console.error('[stripe webhook]', e);
    res.status(500).json({ error: 'Traitement impossible' }); // Stripe réessaiera
  }
});

module.exports = { router: r, webhook };
