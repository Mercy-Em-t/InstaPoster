'use strict';

require('dotenv').config();

const http = require('http');
const app = require('./app');
const { initQueues } = require('./jobs/queue');
const { initWebSocket } = require('./realtime/ws');
const { logInfo, logError } = require('./services/log.service');

const PORT = process.env.PORT || 3001;

async function main() {
  try {
    await initQueues();
    const server = http.createServer(app);
    initWebSocket(server);
    server.listen(PORT, () => {
      logInfo('Server started', {
        port: PORT,
        env: process.env.NODE_ENV || 'development',
      });
    });
  } catch (err) {
    logError({
      message: 'Failed to start server',
      stack: err.stack,
      meta: { detail: err.message },
    });
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  logError({
    message: 'Unhandled Promise rejection',
    stack: reason?.stack,
    meta: { reason: reason?.message || String(reason) },
  });
});

process.on('uncaughtException', (err) => {
  logError({
    message: 'Uncaught exception',
    stack: err.stack,
    meta: { detail: err.message },
  });
  process.exit(1);
});

main();
