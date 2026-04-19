'use strict';

const { createError } = require('../../middleware/errorHandler');
const authService = require('../../services/auth.service');

function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return next(createError(400, 'email and password are required'));

    const result = authService.login(email, password);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

function me(req, res) {
  res.json({ user: req.user || null });
}

module.exports = { login, me };
