'use strict';
/**
 * Paiement en ligne des factures par les familles.
 *
 *  - Stripe Checkout si STRIPE_SECRET_KEY est défini (cartes, 3-D Secure, Apple/Google Pay).
 *    La confirmation arrive UNIQUEMENT par webhook signé (jamais par le navigateur).
 *  - "simulated" sinon : page de paiement factice, réservée au développement.
 *  - Un adaptateur CMI (banques marocaines) suivrait la même interface :
 *    createCheckout() → URL de paiement, puis callback serveur → completePayment().
 *
 * Aucune donnée de carte ne transite par nos serveurs.
 */
const crypto = require('crypto');
const config = require('../config/env');
const M = require('../models');
const { notify, parentsByStudent } = require('./notifier');
const { badRequest } = require('../core/errors');

const stripe = config.payments.stripeKey ? new (require('stripe'))(config.payments.stripeKey) : null;
const provider = () => (stripe ? 'stripe' : 'simulated');

async function createCheckout({ invoice, student, tenant, user }) {
  if (invoice.status === 'paid') throw badRequest('Facture déjà réglée');
  if (invoice.status === 'cancelled') throw badRequest('Facture annulée');
  const ps = await M.PaymentSession.create({
    invoiceId: invoice.id, createdBy: user.id, provider: provider(), amountCents: invoice.amountCents,
    providerSessionId: `pending_${crypto.randomUUID()}`,
  });
  let url, providerSessionId;
  if (stripe) {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      client_reference_id: String(ps.id),
      line_items: [{ quantity: 1, price_data: { currency: tenant.currency.toLowerCase(), unit_amount: invoice.amountCents, product_data: { name: invoice.label, description: `${student.firstName} ${student.lastName} · ${invoice.number} · ${tenant.name}` } } }],
      metadata: { tenantId: String(tenant.id), paymentSessionId: String(ps.id), invoiceId: String(invoice.id) },
      success_url: `${config.clientUrl}/pay/return?session=${ps.id}`,
      cancel_url: `${config.clientUrl}/pay/return?session=${ps.id}&cancelled=1`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    });
    url = session.url; providerSessionId = session.id;
  } else {
    if (config.isProd) throw badRequest('Paiement en ligne non configuré');
    providerSessionId = `sim_${crypto.randomUUID()}`;
    url = `${config.clientUrl}/pay/simulate/${ps.id}`;
  }
  await ps.update({ providerSessionId, checkoutUrl: url });
  return ps;
}

/**
 * Enregistre le paiement de façon idempotente (un webhook peut être rejoué).
 * Doit être appelé dans le contexte du tenant de la session.
 */
async function completePayment(ps, providerRef) {
  const done = await M.sequelize.transaction(async transaction => {
    const fresh = await M.PaymentSession.findByPk(ps.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (fresh.status === 'paid') return null;
    const invoice = await M.Invoice.findByPk(fresh.invoiceId, { transaction, lock: transaction.LOCK.UPDATE });
    await fresh.update({ status: 'paid' }, { transaction });
    if (invoice.status === 'paid') return null; // déjà encaissée par ailleurs : à rembourser manuellement
    await M.Payment.create({ invoiceId: invoice.id, amountCents: fresh.amountCents, method: 'card', providerRef: providerRef || fresh.providerSessionId, paidAt: new Date(), recordedBy: fresh.createdBy }, { transaction });
    await invoice.update({ status: 'paid', paidAt: new Date() }, { transaction });
    return invoice;
  });
  if (done) {
    const parents = await parentsByStudent([done.studentId]);
    await notify(parents[done.studentId] || [], { kind: 'payment', title: 'Paiement reçu — merci !', body: `${done.label} · reçu disponible dans votre espace`, link: '/finance' }, { channels: ['email', 'push'] });
  }
  return done;
}

async function failPayment(ps) {
  if (ps.status === 'pending') await ps.update({ status: 'failed' });
}

/** Vérifie la signature d'un webhook Stripe et renvoie l'événement. */
function parseStripeEvent(rawBody, signature) {
  if (!stripe || !config.payments.stripeWebhookSecret) throw badRequest('Webhook Stripe non configuré');
  return stripe.webhooks.constructEvent(rawBody, signature, config.payments.stripeWebhookSecret);
}

module.exports = { provider, createCheckout, completePayment, failPayment, parseStripeEvent };
