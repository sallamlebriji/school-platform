'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const env = (key, fallback) => {
  const v = process.env[key];
  if (v === undefined || v === '') {
    if (fallback === undefined) throw new Error(`Variable d'environnement manquante : ${key}`);
    return fallback;
  }
  return v;
};

const config = {
  nodeEnv: env('NODE_ENV', 'development'),
  isProd: env('NODE_ENV', 'development') === 'production',
  port: Number(env('PORT', 4000)),
  clientUrl: env('CLIENT_URL', 'http://localhost:5173'),
  db: {
    host: env('DB_HOST', '127.0.0.1'),
    port: Number(env('DB_PORT', 3306)),
    name: env('DB_NAME', 'athenee'),
    user: env('DB_USER', 'root'),
    password: env('DB_PASSWORD', ''),
  },
  jwt: {
    accessSecret: env('JWT_ACCESS_SECRET', 'dev-access-secret'),
    refreshSecret: env('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
    accessTtl: env('ACCESS_TOKEN_TTL', '15m'),
    refreshDays: Number(env('REFRESH_TOKEN_DAYS', 7)),
  },
  encryptionKey: env('DATA_ENCRYPTION_KEY', '0'.repeat(64)),
  allowTenantHeader: env('ALLOW_TENANT_HEADER', 'true') === 'true',
  rootDomain: env('ROOT_DOMAIN', 'athenee.app'),
  ai: {
    apiKey: env('ANTHROPIC_API_KEY', ''),
    model: env('AI_MODEL', 'claude-opus-5'),
  },
  uploads: {
    dir: require('path').resolve(__dirname, '../..', env('UPLOAD_DIR', 'uploads')),
    maxBytes: Number(env('MAX_UPLOAD_MB', 10)) * 1024 * 1024,
  },
  mail: {
    host: env('SMTP_HOST', ''), port: Number(env('SMTP_PORT', 587)), user: env('SMTP_USER', ''), password: env('SMTP_PASSWORD', ''),
    from: env('MAIL_FROM', 'Athénée <no-reply@athenee.app>'),
    outboxDir: require('path').resolve(__dirname, '../../outbox'),
  },
  sms: {
    provider: env('SMS_PROVIDER', 'log'),
    twilio: { sid: env('TWILIO_ACCOUNT_SID', ''), token: env('TWILIO_AUTH_TOKEN', ''), from: env('TWILIO_FROM', '') },
    http: { url: env('SMS_HTTP_URL', ''), token: env('SMS_HTTP_TOKEN', '') },
  },
  push: { publicKey: env('VAPID_PUBLIC_KEY', ''), privateKey: env('VAPID_PRIVATE_KEY', ''), subject: env('VAPID_SUBJECT', 'mailto:contact@athenee.app') },
  payments: { stripeKey: env('STRIPE_SECRET_KEY', ''), stripeWebhookSecret: env('STRIPE_WEBHOOK_SECRET', '') },
};

if (config.isProd) {
  for (const k of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'DATA_ENCRYPTION_KEY']) {
    if (!process.env[k] || /change-me|^0+$/.test(process.env[k])) throw new Error(`${k} doit être défini en production`);
  }
  if (config.allowTenantHeader) throw new Error('ALLOW_TENANT_HEADER doit être false en production');
}

module.exports = config;
