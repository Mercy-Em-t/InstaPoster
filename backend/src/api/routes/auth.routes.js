'use strict';

const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { auth } = require('../../middleware/auth');

const router = Router();

router.post('/login', authController.login);
router.get('/me', auth, authController.me);

module.exports = router;
