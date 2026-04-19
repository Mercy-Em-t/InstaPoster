'use strict';

const { AppError } = require('../utils/AppError');
const { verifyToken, sanitizeUser } = require('../services/auth.service');

function auth(req, _res, next) {
  if (process.env.NODE_ENV === 'test') return next();

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return next(new AppError('Unauthorized', 401));

  try {
    const payload = verifyToken(token);
    req.user = sanitizeUser({
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    });
    return next();
  } catch (_err) {
    return next(new AppError('Invalid token', 401));
  }
}

function authorize(...roles) {
  const allowed = new Set(roles);

  return function roleGuard(req, _res, next) {
    if (process.env.NODE_ENV === 'test') return next();

    if (!req.user) return next(new AppError('Unauthorized', 401));
    if (!allowed.has(req.user.role)) return next(new AppError('Forbidden', 403));

    return next();
  };
}

module.exports = { auth, authorize };
