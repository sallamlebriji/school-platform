'use strict';
/**
 * Crée la base, applique database/schema.sql puis les migrations.
 *   npm run db:init           → échoue si les tables existent déjà
 *   node scripts/db-init.js --drop  → supprime et recrée la base (DÉVELOPPEMENT uniquement)
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config/env');
const { migrate } = require('./db-migrate');

(async () => {
  const drop = process.argv.includes('--drop');
  if (drop && config.isProd) throw new Error('--drop interdit en production');
  const conn = await mysql.createConnection({ host: config.db.host, port: config.db.port, user: config.db.user, password: config.db.password, multipleStatements: true });
  const db = config.db.name.replace(/[^a-zA-Z0-9_]/g, '');
  if (drop) { await conn.query(`DROP DATABASE IF EXISTS \`${db}\``); console.log(`Base ${db} supprimée`); }
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${db}\``);
  const sql = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
  await conn.query(sql);
  await migrate(conn);
  const [rows] = await conn.query('SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ?', [db]);
  console.log(`Schéma appliqué : ${rows[0].n} tables dans ${db}`);
  await conn.end();
})().catch(e => { console.error(e.message); process.exit(1); });
