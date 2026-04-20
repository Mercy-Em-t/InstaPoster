'use strict';

/**
 * Error Handler Middleware
 */
const { AppError } = require('../utils/AppError');
const { logError } = require('../services/log.service');

function errorHandler(err, req, res, _next) {
  const normalizedError = normalizeError(err);
  const status = normalizedError.statusCode || normalizedError.status || 500;
  const message = normalizedError.message || 'Internal Server Error';

  logError({
    requestId: req.requestId,
    message,
    stack: normalizedError.stack,
    path: req.originalUrl || req.path,
    method: req.method,
    meta: normalizedError.meta || {},
  });

  res.status(status).json({
    error: message,
    requestId: req.requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: normalizedError.stack }),
  });
}

/**
 * Create a well-formed HTTP error
 */
function createError(status, message) {
  return new AppError(message, status);
}

function normalizeError(err) {
  if (err instanceof AppError) return err;

  if (err && typeof err === 'object' && err.code && String(err.code).startsWith('P')) {
    const mapped = mapPrismaStatus(err.code);
    return new AppError('Database request failed', mapped, { code: err.code, detail: err.meta || {} });
  }

  const status = err?.statusCode || err?.status || 500;
  const message = err?.message || 'Internal Server Error';
  return new AppError(message, status, { originalName: err?.name });
}

function mapPrismaStatus(code) {
  if (code === 'P2002') return 409;
  if (code === 'P2025') return 404;
  return 400;
}

module.exports = { errorHandler, createError, normalizeError };
