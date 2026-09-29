'use strict';
/**
 * Fichiers : téléversement et lecture contrôlée.
 *   POST /files?kind=homework   (multipart, champ "file")
 *   GET  /files/:id             (droits vérifiés selon le type de fichier)
 */
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { z } = require('zod');
const config = require('../config/env');
const { File } = require('../models');
const { validate } = require('../middlewares/common');
const { idParam } = require('../core/crud');
const { asyncHandler, badRequest, forbidden, notFound } = require('../core/errors');
const storage = require('../services/storage');

const r = express.Router();
const KINDS = ['attendance_proof', 'homework', 'lost_photo', 'logo', 'document', 'course', 'import', 'other'];
const STAFF = ['admin', 'staff'];

/** Qui peut téléverser quel type de fichier. */
const CAN_UPLOAD = {
  logo: ['admin'], import: ['admin', 'staff'], document: ['admin', 'staff'], course: ['admin', 'staff', 'teacher'],
};
/** Types visibles par tout utilisateur connecté de l'établissement. */
const TENANT_VISIBLE = ['logo', 'lost_photo', 'course'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploads.maxBytes, files: 1 },
  fileFilter: (req, file, cb) => (storage.ALLOWED[file.mimetype] ? cb(null, true) : cb(badRequest(`Type de fichier non autorisé (${file.mimetype})`))),
});

r.post('/files', (req, res, next) => upload.single('file')(req, res, err => {
  if (err && err.code === 'LIMIT_FILE_SIZE') return next(badRequest(`Fichier trop volumineux (max ${config.uploads.maxBytes / 1048576} Mo)`));
  next(err);
}), validate({ query: z.object({ kind: z.enum(KINDS).default('other') }) }), asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('Aucun fichier reçu (champ "file")');
  const kind = req.validQuery.kind;
  if (CAN_UPLOAD[kind] && !CAN_UPLOAD[kind].includes(req.user.role)) throw forbidden('Type de fichier non autorisé pour votre rôle');
  if (!storage.sniff(req.file.buffer, req.file.mimetype)) throw badRequest('Le contenu du fichier ne correspond pas à son type');
  const { key, sha256 } = storage.put(req.tenant.id, req.file.buffer, req.file.mimetype);
  const f = await File.create({
    ownerUserId: req.user.id, kind, originalName: req.file.originalname.slice(0, 255), mime: req.file.mimetype,
    sizeBytes: req.file.size, storageKey: key, sha256,
  });
  res.status(201).json(publicFile(f));
}));

r.get('/files/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const f = await File.findByPk(req.params.id);
  if (!f) throw notFound();
  if (!canRead(req.user, f)) throw forbidden();
  res.setHeader('Content-Type', f.mime);
  res.setHeader('Content-Disposition', `${f.mime.startsWith('image/') || f.mime === 'application/pdf' ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.originalName)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(storage.absPath(f.storageKey)).on('error', () => res.status(404).end()).pipe(res);
}));

function canRead(user, f) {
  if (Number(f.ownerUserId) === Number(user.id) || STAFF.includes(user.role) || TENANT_VISIBLE.includes(f.kind)) return true;
  if (f.kind === 'homework') return user.role === 'teacher';
  if (f.kind === 'attendance_proof') return user.role === 'nurse';
  return false;
}

const publicFile = f => ({ id: f.id, url: `/api/files/${f.id}`, name: f.originalName, mime: f.mime, size: f.sizeBytes, kind: f.kind });

/**
 * Vérifie qu'un fichier existe dans le tenant, appartient à l'utilisateur
 * et a le bon type, avant de le rattacher à un enregistrement métier.
 */
async function claimFile(user, fileId, kind) {
  const f = await File.findByPk(fileId);
  if (!f || f.kind !== kind) throw badRequest('Fichier joint invalide');
  if (Number(f.ownerUserId) !== Number(user.id) && !STAFF.includes(user.role)) throw forbidden('Ce fichier ne vous appartient pas');
  return f;
}

module.exports = { router: r, claimFile, publicFile, fileUrl: id => `/api/files/${id}` };
