'use strict';

const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/AppError');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new AppError('JWT_SECRET must be configured in production', 500);
  }
  return secret || 'dev-insecure-secret';
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || '7d';
}

function getConfiguredUsers() {
  const raw = process.env.DASHBOARD_USERS;

  if (!raw) {
    return [
      { id: 'dev-admin', email: 'admin@local', password: 'admin123', role: 'ADMIN', name: 'Local Admin' },
      { id: 'dev-staff', email: 'staff@local', password: 'staff123', role: 'STAFF', name: 'Local Staff' },
      { id: 'dev-viewer', email: 'viewer@local', password: 'viewer123', role: 'VIEWER', name: 'Local Viewer' },
    ];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('DASHBOARD_USERS must be a non-empty array');
    }

    return parsed.map((user, index) => ({
      id: user.id || `configured-${index + 1}`,
      email: String(user.email || '').toLowerCase(),
      password: String(user.password || ''),
      role: user.role || 'STAFF',
      name: user.name || user.email,
    }));
  } catch (err) {
    throw new AppError('Invalid DASHBOARD_USERS configuration', 500, { detail: err.message });
  }
}

function findUserByEmail(email) {
  if (!email) return null;
  const normalized = String(email).toLowerCase();
  return getConfiguredUsers().find((user) => user.email === normalized) || null;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };
}

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    getJwtSecret(),
    { expiresIn: getJwtExpiresIn() }
  );
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

function login(email, password) {
  const user = findUserByEmail(email);

  if (!user || user.password !== String(password || '')) {
    throw new AppError('Invalid email or password', 401);
  }

  const token = issueToken(user);
  return { token, user: sanitizeUser(user) };
}

module.exports = {
  login,
  verifyToken,
  sanitizeUser,
};
