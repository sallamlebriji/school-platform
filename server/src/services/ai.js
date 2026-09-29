'use strict';
/**
 * Assistant IA de l'école — appelle Claude côté serveur uniquement.
 * Le contexte transmis au modèle est construit à partir de données déjà
 * filtrées par tenant ET par rôle ; les données de santé ne sont jamais incluses.
 * Sans ANTHROPIC_API_KEY, un moteur local de secours répond.
 */
const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config/env');

const client = config.ai.apiKey ? new Anthropic({ apiKey: config.ai.apiKey }) : null;

function systemPrompt(tenant, user, context) {
  return [
    `Tu es l'assistant pédagogique et administratif de l'établissement « ${tenant.name} » (${tenant.city || ''}), sur la plateforme Athénée.`,
    `Tu t'adresses à ${user.firstName} ${user.lastName}, rôle : ${user.role}. Réponds en français, de façon claire, structurée et bienveillante.`,
    'Tu peux générer des exercices, des quiz, des fiches de révision, résumer un cours, analyser des résultats et répondre aux questions pratiques sur l\'école.',
    'N\'utilise que les données fournies ci-dessous pour parler d\'élèves réels ; si une information manque, dis-le au lieu de l\'inventer.',
    'Ne donne jamais d\'informations médicales sur un élève.',
    context ? `\nDonnées autorisées pour cet utilisateur (JSON) :\n${JSON.stringify(context)}` : '',
  ].join('\n');
}

/**
 * @param {object} p
 * @param {object} p.tenant
 * @param {object} p.user
 * @param {{role:'user'|'assistant', content:string}[]} p.messages
 * @param {object} [p.context]  données métier filtrées
 */
async function chat({ tenant, user, messages, context }) {
  if (!client) return { text: localAnswer(messages[messages.length - 1].content, context), model: 'local-fallback' };

  const response = await client.beta.messages.create({
    model: config.ai.model,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
    // Si le modèle principal décline une requête, l'API bascule automatiquement vers un modèle de secours.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: systemPrompt(tenant, user, context),
    messages,
  });

  if (response.stop_reason === 'refusal') {
    return { text: 'Je ne peux pas répondre à cette demande. Reformulez-la ou contactez l\'administration.', model: response.model };
  }
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  return { text, model: response.model, usage: response.usage };
}

function localAnswer(q, context = {}) {
  const n = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/quiz|qcm/.test(n)) return '**Quiz (5 questions)**\n1. 3/4 + 1/8 = ? → **7/8**\n2. Simplifier 18/24 → **3/4**\n3. La plus grande : 2/5, 3/10, 1/2 → **1/2**\n4. 3/5 de 40 → **24**\n5. Vrai/faux : 5/6 > 6/7 → **Faux**';
  if (/absen/.test(n) && context.absencesToday != null) return `Il y a **${context.absencesToday} absence(s)** enregistrée(s) aujourd'hui.`;
  if (/moyenne|resultat|note/.test(n) && context.averages) return `Moyenne générale : **${context.averages.general ?? '—'}/20**.`;
  return 'Assistant en mode local (aucune clé ANTHROPIC_API_KEY configurée). Je peux générer un quiz, donner les absences du jour ou les moyennes.';
}

module.exports = { chat };
