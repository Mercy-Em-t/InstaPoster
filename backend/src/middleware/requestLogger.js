'use strict';

const { randomUUID } = require('crypto');
const { logRequest } = require('../services/log.service');

function requestLogger(req, res, next) {
  const requestId = req.headers['x-request-id'] || randomUUID();
  const start = Date.now();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    logRequest({
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      requestId,
    });
  });

  next();
}

module.exports = { requestLogger };
