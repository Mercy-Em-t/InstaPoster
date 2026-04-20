'use strict';

const { Router } = require('express');
const ordersController = require('../controllers/orders.controller');

const router = Router();

// Orders dashboard from bridge + payment status + tracking source
router.get('/', ordersController.listOrders);

module.exports = router;
