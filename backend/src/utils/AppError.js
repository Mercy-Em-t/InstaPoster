'use strict';

class AppError extends Error {
  constructor(message, statusCode = 500, meta = {}) {
    super(message || 'Internal Server Error');
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;
    this.meta = meta;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { AppError };
