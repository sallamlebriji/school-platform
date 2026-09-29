'use strict';
const http = require('http');
const config = require('./config/env');
const { sequelize } = require('./models');
const app = require('./app');
const { initRealtime } = require('./services/realtime');

async function start() {
  await sequelize.authenticate();
  const server = http.createServer(app);
  initRealtime(server);
  server.listen(config.port, () => console.log(`Athénée API → http://localhost:${config.port}  (MySQL ${config.db.host}/${config.db.name})`));

  const shutdown = async () => { server.close(); await sequelize.close(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch(err => { console.error('Démarrage impossible :', err.message); process.exit(1); });
