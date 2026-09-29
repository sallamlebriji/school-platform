'use strict';
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const config = require('./config/env');
const { resolveTenant } = require('./middlewares/tenant');
const { authenticate } = require('./middlewares/auth');
const { audit, errorHandler } = require('./middlewares/common');
const { notFound } = require('./core/errors');

const authRoutes = require('./modules/auth.routes');
const schoolRoutes = require('./modules/school.routes');
const pedagogyRoutes = require('./modules/pedagogy.routes');
const { router: lifeRoutes, publicEnrollment } = require('./modules/life.routes');
const adminRoutes = require('./modules/admin.routes');
const { router: fileRoutes } = require('./modules/files.routes');
const { router: paymentRoutes, webhook: paymentWebhook } = require('./modules/payments.routes');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet());
app.use(cors({ origin: config.clientUrl, credentials: true }));
// Webhooks de paiement : corps brut (signature), hors tenant — AVANT express.json
app.use('/api/webhooks', paymentWebhook);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
if (config.nodeEnv === 'development') app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ------------------------------------------------------------------
// Toute l'API est scopée à un établissement (tenant).
// ------------------------------------------------------------------
const api = express.Router();
api.use(resolveTenant);
api.use(audit);

// Routes publiques (dans le tenant, sans session)
api.use('/auth', authRoutes);
api.use('/public/enrollments', publicEnrollment);

// Routes authentifiées
api.use(authenticate);
api.use(fileRoutes);
api.use(paymentRoutes);
api.use(schoolRoutes);
api.use(pedagogyRoutes);
api.use(lifeRoutes);
api.use(adminRoutes);

app.use('/api', api);
app.use((req, res, next) => next(notFound('Route inconnue')));
app.use(errorHandler);

module.exports = app;
