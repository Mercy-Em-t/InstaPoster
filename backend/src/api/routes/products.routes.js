'use strict';

const { Router } = require('express');
const productsController = require('../controllers/products.controller');

const router = Router();

// All product routes are READ ONLY — data comes from unified_products view
router.get('/', productsController.listProducts);
router.get('/:id', productsController.getProduct);

module.exports = router;
