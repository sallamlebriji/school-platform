'use strict';

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const badRequest = (msg = 'Requête invalide', details) => new HttpError(400, msg, details);
const unauthorized = (msg = 'Authentification requise') => new HttpError(401, msg);
const forbidden = (msg = 'Accès refusé') => new HttpError(403, msg);
const notFound = (msg = 'Ressource introuvable') => new HttpError(404, msg);
const conflict = (msg = 'Conflit', details) => new HttpError(409, msg, details);

/** Enveloppe un handler async pour transmettre les erreurs à Express. */
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict, asyncHandler };
