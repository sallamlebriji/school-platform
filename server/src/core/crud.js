'use strict';
/**
 * Fabrique de routes CRUD REST pour les ressources simples.
 * Le filtrage par tenant est automatique (hooks Sequelize) ; `scope` permet
 * d'ajouter une restriction par utilisateur (ex. un parent → ses enfants).
 *
 *   GET    /        liste paginée  ?page&limit&q&<filtre>=…&sort=champ|-champ
 *   GET    /:id
 *   POST   /
 *   PATCH  /:id
 *   DELETE /:id
 */
const express = require('express');
const { Op } = require('sequelize');
const { z } = require('zod');
const { requirePerm } = require('../middlewares/auth');
const { validate } = require('../middlewares/common');
const { asyncHandler, notFound } = require('./errors');

const idParam = z.object({ id: z.coerce.number().int().positive() });

function crudRouter(opts) {
  const {
    model: Model, resource, search = [], filters = [], include = [], defaultSort = '-id',
    createSchema, updateSchema, scope, beforeCreate, afterCreate, only = ['list', 'get', 'create', 'update', 'delete'],
    readPerm = `${resource}:read`, writePerm = `${resource}:write`,
  } = opts;
  const router = opts.router || express.Router();

  const scopedWhere = async req => (scope ? await scope(req) : {}) || {};

  if (only.includes('list')) router.get('/', requirePerm(readPerm, `${resource}:*`), asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 25));
    const where = { ...(await scopedWhere(req)) };
    for (const f of filters) if (req.query[f] !== undefined && req.query[f] !== '') where[f] = req.query[f];
    if (req.query.q && search.length) where[Op.or] = search.map(f => ({ [f]: { [Op.like]: `%${req.query.q}%` } }));
    const sort = String(req.query.sort || defaultSort);
    const field = sort.replace(/^-/, '');
    const order = [[Model.rawAttributes[field] ? field : 'id', sort.startsWith('-') ? 'DESC' : 'ASC']];
    const { rows, count } = await Model.findAndCountAll({ where, include, order, limit, offset: (page - 1) * limit, distinct: true });
    res.json({ data: rows, total: count, page, limit });
  }));

  const loadOne = async req => {
    const row = await Model.findOne({ where: { id: req.params.id, ...(await scopedWhere(req)) }, include });
    if (!row) throw notFound();
    return row;
  };

  if (only.includes('get')) router.get('/:id', requirePerm(readPerm, `${resource}:*`), validate({ params: idParam }), asyncHandler(async (req, res) => {
    res.json(await loadOne(req));
  }));

  if (only.includes('create')) router.post('/', requirePerm(writePerm, `${resource}:*`), ...(createSchema ? [validate({ body: createSchema })] : []), asyncHandler(async (req, res) => {
    const data = beforeCreate ? await beforeCreate(req, { ...req.body }) : { ...req.body };
    delete data.id; delete data.tenantId; // jamais fournis par le client
    const row = await Model.create(data);
    if (afterCreate) await afterCreate(req, row);
    res.status(201).json(row);
  }));

  if (only.includes('update')) router.patch('/:id', requirePerm(writePerm, `${resource}:*`), validate({ params: idParam, ...(updateSchema ? { body: updateSchema } : {}) }), asyncHandler(async (req, res) => {
    const row = await loadOne(req);
    const data = { ...req.body }; delete data.id; delete data.tenantId;
    await row.update(data);
    res.json(row);
  }));

  if (only.includes('delete')) router.delete('/:id', requirePerm(writePerm, `${resource}:*`), validate({ params: idParam }), asyncHandler(async (req, res) => {
    const row = await loadOne(req);
    await row.destroy();
    res.status(204).end();
  }));

  return router;
}

module.exports = { crudRouter, idParam };
