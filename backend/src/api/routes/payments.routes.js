'use strict';

const { Router } = require('express');
const paymentsController = require('../controllers/payments.controller');

const router = Router();

// Initiate M-Pesa STK push
router.post('/stk-push', paymentsController.initiatePayment);

// Safaricom callback (body already raw-buffered in app.js)
router.post('/mpesa/callback', paymentsController.mpesaCallback);

// Payments monitor list + retry
router.get('/', paymentsController.listPayments);
router.post('/:id/retry', paymentsController.retryPayment);

// Query single payment status
router.get('/:id', paymentsController.getPayment);

module.exports = router;
