'use strict';

const { logger } = require('../utils/logger');

function logRequest({ method, path, statusCode, durationMs, requestId }) {
  logger.info({
    type: 'REQUEST',
    requestId,
    method,
    path,
    statusCode,
    durationMs,
  });
}

function logInfo(message, meta = {}) {
  logger.info({ type: 'INFO', message, meta });
}

function logWarn(message, meta = {}) {
  logger.warn({ type: 'WARN', message, meta });
}

function logError({ message, stack, path, method, requestId, meta = {} }) {
  logger.error({
    type: 'APPLICATION_ERROR',
    requestId,
    message,
    path,
    method,
    stack,
    meta,
  });
}

function logQueueFailure({ queue, jobName, jobId, data, error }) {
  logger.error({
    type: 'QUEUE_FAILURE',
    queue,
    jobName,
    jobId,
    data,
    error,
  });
}

module.exports = {
  logRequest,
  logInfo,
  logWarn,
  logError,
  logQueueFailure,
};
