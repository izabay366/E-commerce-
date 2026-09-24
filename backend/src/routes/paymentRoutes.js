/**
 * paymentRoutes.js
 * Route definitions for the Payment API.
 *
 * Routes:
 *   GET   /api/payments                 getAllPayments     — JWT required + ADMIN role only
 *   GET   /api/payments/order/:orderId  getPaymentByOrder — JWT required (admin or order owner)
 *   GET   /api/payments/:id            getPayment        — JWT required (admin or payment owner)
 *   PATCH /api/payments/:id            updatePayment     — JWT required + ADMIN role only
 *
 * IMPORTANT: Static routes MUST be registered BEFORE /:id to prevent Express
 * from matching literal path segments as UUID-format :id parameters.
 */

'use strict';

const express = require('express');
const router  = express.Router();

const authenticate      = require('../middleware/authenticate');
const paymentController = require('../controllers/paymentController');

// GET /api/payments — admin list of all payments (static root, registered first)
router.get('/', authenticate, paymentController.getAllPayments);

// GET /api/payments/order/:orderId — fetch payment by order ID (static segment before /:id)
router.get('/order/:orderId', authenticate, paymentController.getPaymentByOrder);

// GET /api/payments/:id — fetch payment by payment ID
router.get('/:id', authenticate, paymentController.getPayment);

// PATCH /api/payments/:id — admin-only payment status update
router.patch('/:id', authenticate, paymentController.updatePayment);

module.exports = router;
