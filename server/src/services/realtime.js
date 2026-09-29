'use strict';
/**
 * Temps réel (Socket.IO) : positions de bus, chat, notifications.
 * Salons : tenant:<id> · user:<id> · bus:<id> · conv:<id>
 * Un socket ne rejoint JAMAIS un salon d'un autre tenant.
 */
const jwt = require('jsonwebtoken');
const config = require('../config/env');

let io = null;

function initRealtime(server) {
  const { Server } = require('socket.io');
  io = new Server(server, { cors: { origin: config.clientUrl, credentials: true } });
  io.use((socket, next) => {
    try {
      const p = jwt.verify(socket.handshake.auth.token, config.jwt.accessSecret);
      socket.data = { userId: p.sub, tenantId: p.tid, role: p.role };
      next();
    } catch { next(new Error('unauthorized')); }
  });
  io.on('connection', socket => {
    const { tenantId, userId } = socket.data;
    socket.join(`tenant:${tenantId}`);
    socket.join(`user:${tenantId}:${userId}`);
    // Suivi d'un bus : l'appartenance au tenant est garantie par le préfixe du salon.
    socket.on('bus:follow', busId => socket.join(`bus:${tenantId}:${Number(busId)}`));
    socket.on('bus:unfollow', busId => socket.leave(`bus:${tenantId}:${Number(busId)}`));
    socket.on('conv:join', convId => socket.join(`conv:${tenantId}:${Number(convId)}`));
  });
  return io;
}

const emit = (room, event, payload) => { if (io) io.to(room).emit(event, payload); };
const toUser = (tenantId, userId, event, payload) => emit(`user:${tenantId}:${userId}`, event, payload);
const toTenant = (tenantId, event, payload) => emit(`tenant:${tenantId}`, event, payload);
const toBus = (tenantId, busId, event, payload) => emit(`bus:${tenantId}:${busId}`, event, payload);
const toConversation = (tenantId, convId, event, payload) => emit(`conv:${tenantId}:${convId}`, event, payload);

module.exports = { initRealtime, toUser, toTenant, toBus, toConversation };
