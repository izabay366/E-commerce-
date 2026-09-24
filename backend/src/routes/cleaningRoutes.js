/**
 * cleaningRoutes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Routes for the Cleaning Services module.
 *
 * Registered in server.js as:
 *   app.use('/api/cleaning-services', cleaningServiceRoutes);
 *   app.use('/api/cleaners',          cleanerRoutes);
 *   app.use('/api/cleaning-requests', cleaningRequestRoutes);
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express    = require('express');
const authenticate = require('../middleware/authenticate');
const ctrl       = require('../controllers/cleaningController');

// ─── /api/cleaning-services ──────────────────────────────────────────────────

const serviceRouter = express.Router();

// Public
serviceRouter.get('/',        ctrl.getServices);        // active services (no auth)
serviceRouter.get('/admin',   authenticate, ctrl.getServicesAdmin); // admin: all incl inactive
serviceRouter.get('/:id',     ctrl.getService);         // one service (no auth)

// Admin only
serviceRouter.post('/',       authenticate, ctrl.createService);
serviceRouter.patch('/:id',   authenticate, ctrl.updateService);
serviceRouter.delete('/:id',  authenticate, ctrl.deleteService);

// ─── /api/cleaners ───────────────────────────────────────────────────────────

const cleanerRouter = express.Router();

// Admin only — customer phone numbers should not be exposed publicly
cleanerRouter.get('/',        authenticate, ctrl.getCleaners);
cleanerRouter.post('/',       authenticate, ctrl.createCleaner);
cleanerRouter.patch('/:id',   authenticate, ctrl.updateCleaner);

// ─── /api/cleaning-requests ──────────────────────────────────────────────────

const requestRouter = express.Router();

// Customer (must be logged in)
requestRouter.post('/',              authenticate, ctrl.createRequest);
requestRouter.get('/mine',           authenticate, ctrl.getMyRequests);
requestRouter.patch('/:id/cancel',   authenticate, ctrl.cancelRequest);
requestRouter.get('/:id',            authenticate, ctrl.getRequest);

// Admin
requestRouter.get('/',               authenticate, ctrl.getAllRequests);
requestRouter.patch('/:id',          authenticate, ctrl.updateRequest);

module.exports = { serviceRouter, cleanerRouter, requestRouter };
