'use strict';
const { Sequelize } = require('sequelize');
const config = require('./env');

const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
  host: config.db.host,
  port: config.db.port,
  dialect: 'mysql',
  logging: false,
  timezone: '+00:00',
  define: {
    underscored: true,      // colonnes snake_case (tenant_id, created_at…)
    freezeTableName: true,
    timestamps: true,
  },
  dialectOptions: { dateStrings: true, typeCast: true, decimalNumbers: true },
  pool: { max: 10, min: 0, idle: 10000 },
});

module.exports = sequelize;
