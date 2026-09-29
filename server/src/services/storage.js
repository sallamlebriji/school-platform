'use strict';
/**
 * Stockage des fichiers téléversés.
 * Implémentation disque local, clés préfixées par le tenant :
 *   uploads/<tenantId>/<AAAA-MM>/<uuid>.<ext>
 * Pour la production, remplacer put/absPath/remove par un adaptateur S3
 * (même interface) sans toucher aux routes.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/env');

/** Types acceptés : mime → extension. Tout le reste est refusé. */
const ALLOWED = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/csv': '.csv',
};

/** Vérifie la signature binaire (magic bytes) pour ne pas se fier au seul mime déclaré. */
function sniff(buf, mime) {
  const hex = buf.subarray(0, 8).toString('hex');
  if (mime === 'application/pdf') return buf.subarray(0, 5).toString() === '%PDF-';
  if (mime === 'image/jpeg') return hex.startsWith('ffd8ff');
  if (mime === 'image/png') return hex === '89504e470d0a1a0a';
  if (mime === 'image/webp') return buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP';
  if (mime.includes('openxmlformats')) return hex.startsWith('504b0304'); // conteneur ZIP
  if (mime === 'text/csv') return !buf.subarray(0, 1024).includes(0);
  return false;
}

function put(tenantId, buffer, mime) {
  const month = new Date().toISOString().slice(0, 7);
  const key = path.posix.join(String(tenantId), month, crypto.randomUUID() + ALLOWED[mime]);
  const abs = absPath(key);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buffer, { flag: 'wx' });
  return { key, sha256: crypto.createHash('sha256').update(buffer).digest('hex') };
}

function absPath(key) {
  const abs = path.resolve(config.uploads.dir, key);
  if (!abs.startsWith(config.uploads.dir + path.sep)) throw new Error('Chemin de fichier invalide');
  return abs;
}

function remove(key) { try { fs.unlinkSync(absPath(key)); } catch { /* déjà absent */ } }

module.exports = { ALLOWED, sniff, put, absPath, remove };
