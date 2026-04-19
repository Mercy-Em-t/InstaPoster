'use strict';

const { Router } = require('express');
const analyticsController = require('../controllers/analytics.controller');

const router = Router();

// Post-level analytics (clicks, sales, conversion)
router.get('/posts', analyticsController.getPostAnalytics);

module.exports = router;
