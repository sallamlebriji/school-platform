'use strict';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

// ---------- Chiffrement applicatif AES-256-GCM (données de santé) ----------
const KEY = Buffer.from(config.encryptionKey, 'hex');
if (KEY.length !== 32) throw new Error('DATA_ENCRYPTION_KEY doit faire 64 caractères hexadécimaux');

function encrypt(plain) {
  if (plain == null || plain === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

function decrypt(payload) {
  if (!payload) return null;
  const [v, iv, tag, data] = payload.split(':');
  if (v !== 'v1') throw new Error('Format chiffré inconnu');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

// ---------- Jetons ----------
const signAccess = user => jwt.sign({ sub: user.id, tid: user.tenantId, role: user.role }, config.jwt.accessSecret, { expiresIn: config.jwt.accessTtl });
const newRefreshToken = () => crypto.randomBytes(48).toString('base64url');
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

module.exports = { encrypt, decrypt, signAccess, newRefreshToken, sha256 };
