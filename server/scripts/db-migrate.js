'use strict';
/**
 * Applique les migrations de database/migrations/ dans l'ordre (NNN_nom.sql).
 * Chaque migration n'est appliquée qu'une fois (table schema_migrations).
 *   npm run db:migrate
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config/env');

async function migrate(conn) {
  await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(190) NOT NULL PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [done] = await conn.query('SELECT name FROM schema_migrations');
  const applied = new Set(done.map(r => r.name));
  const dir = path.join(__dirname, '../database/migrations');
  const files = fs.readdirSync(dir).filter(f => /^\d{3}_.+\.sql$/.test(f)).sort();
  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await conn.query(sql);
    await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
    console.log(`  ✓ migration ${file}`);
    count++;
  }
  console.log(count ? `${count} migration(s) appliquée(s)` : 'Base à jour, aucune migration à appliquer');
}

if (require.main === module) {
  (async () => {
    const conn = await mysql.createConnection({ host: config.db.host, port: config.db.port, user: config.db.user, password: config.db.password, database: config.db.name, multipleStatements: true });
    await migrate(conn);
    await conn.end();
  })().catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { migrate };
