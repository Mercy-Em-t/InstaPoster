'use strict';

const { Router } = require('express');
const trackingController = require('../controllers/tracking.controller');

const router = Router();

// Short-link redirect: GET /api/t/:code
// Logs click then redirects to product/shop page
router.get('/:code', trackingController.handleClick);

module.exports = router;
