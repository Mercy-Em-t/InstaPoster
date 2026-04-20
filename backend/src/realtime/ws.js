'use strict';

const { WebSocketServer } = require('ws');
const { logInfo, logWarn } = require('../services/log.service');

let wss = null;

function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket) => {
    logInfo('WebSocket client connected');

    socket.send(JSON.stringify({ type: 'system:connected', ts: new Date().toISOString() }));

    socket.on('error', (err) => {
      logWarn('WebSocket client error', { detail: err.message });
    });
  });

  logInfo('WebSocket server initialized', { path: '/ws' });
  return wss;
}

function broadcast(type, payload = {}) {
  if (!wss) return;

  const message = JSON.stringify({
    type,
    payload,
    ts: new Date().toISOString(),
  });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

module.exports = {
  initWebSocket,
  broadcast,
};
