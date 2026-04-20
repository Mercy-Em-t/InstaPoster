'use strict';

const { Router } = require('express');
const webhooksController = require('../controllers/webhooks.controller');

const router = Router();

// Receives order events from existing shop systems
router.post('/order-created', webhooksController.orderCreated);

module.exports = router;
