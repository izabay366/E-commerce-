/**
 * cleaningController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * HTTP handlers for the Cleaning Services module.
 *
 * PUBLIC (no auth required):
 *   GET  /api/cleaning-services              — list active services
 *   GET  /api/cleaning-services/:id          — get one service
 *
 * CUSTOMER (JWT required):
 *   POST   /api/cleaning-requests            — create a booking
 *   GET    /api/cleaning-requests/mine       — customer's own requests
 *   GET    /api/cleaning-requests/:id        — get one request (owner or admin)
 *   PATCH  /api/cleaning-requests/:id/cancel — customer cancels PENDING request
 *
 * ADMIN ONLY (JWT + role=ADMIN):
 *   GET    /api/cleaning-services/admin      — all services incl. inactive
 *   POST   /api/cleaning-services            — create service
 *   PATCH  /api/cleaning-services/:id        — update/deactivate service
 *   DELETE /api/cleaning-services/:id        — delete service
 *   GET    /api/cleaners                     — all cleaners (admin)
 *   POST   /api/cleaners                     — create cleaner
 *   PATCH  /api/cleaners/:id                 — update cleaner
 *   GET    /api/cleaning-requests            — all requests
 *   PATCH  /api/cleaning-requests/:id        — update status/assign cleaner
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const cleaningService = require('../services/cleaningService');

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(str) {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

// cleaning_services.id and cleaners.id are plain integer PKs in the live DB.
function isValidId(val) {
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  return Number.isInteger(num) && num > 0;
}

function isAdmin(req) {
  return req.user && req.user.role?.toLowerCase() === 'admin';
}

function handleError(res, err, context) {
  const code = err.statusCode;
  if (code && code >= 400 && code < 500) {
    return res.status(code).json({ success: false, message: err.message });
  }
  console.error(`[CleaningController] ${context}:`, err.message);
  return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
}

// ─── CLEANING SERVICES — PUBLIC ───────────────────────────────────────────────

/**
 * GET /api/cleaning-services
 * Returns all active services. No auth required.
 */
const getServices = async (req, res) => {
  try {
    const services = await cleaningService.getAllServices();
    return res.status(200).json({ success: true, count: services.length, data: services });
  } catch (err) {
    return handleError(res, err, 'getServices');
  }
};

/**
 * GET /api/cleaning-services/:id
 * Returns one service by UUID.
 */
const getService = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid service ID.' });
  }
  try {
    const service = await cleaningService.getServiceById(id);
    if (!service) {
      return res.status(404).json({ success: false, message: `Service not found: ${id}` });
    }
    // Hide inactive services from non-admins
    if (!service.is_active && !isAdmin(req)) {
      return res.status(404).json({ success: false, message: `Service not found: ${id}` });
    }
    return res.status(200).json({ success: true, data: service });
  } catch (err) {
    return handleError(res, err, 'getService');
  }
};

// ─── CLEANING SERVICES — ADMIN ────────────────────────────────────────────────

/**
 * GET /api/cleaning-services/admin
 * Admin: returns ALL services including inactive.
 */
const getServicesAdmin = async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  try {
    const services = await cleaningService.getAllServicesAdmin();
    return res.status(200).json({ success: true, count: services.length, data: services });
  } catch (err) {
    return handleError(res, err, 'getServicesAdmin');
  }
};

/**
 * POST /api/cleaning-services
 * Admin: create a new cleaning service.
 */
const createService = async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const { name, description, base_price, estimated_duration } = req.body;

  const errors = [];
  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('name is required.');
  }
  if (base_price !== undefined && base_price !== null) {
    const price = parseFloat(base_price);
    if (isNaN(price) || price < 0) errors.push('base_price must be a non-negative number.');
  }
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed.', errors });
  }

  try {
    const service = await cleaningService.createService({
      name: name.trim(),
      description: description?.trim() || null,
      base_price: base_price !== undefined ? parseFloat(base_price) : null,
      estimated_duration: estimated_duration?.trim() || null,
    });
    return res.status(201).json({ success: true, data: service });
  } catch (err) {
    return handleError(res, err, 'createService');
  }
};

/**
 * PATCH /api/cleaning-services/:id
 * Admin: update a cleaning service (name, price, is_active, etc.).
 */
const updateService = async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid service ID.' });
  }

  const allowed = ['name', 'description', 'base_price', 'estimated_duration', 'is_active'];
  const fields = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) fields[key] = req.body[key];
  }

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields to update.' });
  }

  try {
    const updated = await cleaningService.updateService(id, fields);
    if (!updated) {
      return res.status(404).json({ success: false, message: `Service not found: ${id}` });
    }
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    return handleError(res, err, 'updateService');
  }
};

/**
 * DELETE /api/cleaning-services/:id
 * Admin: permanently deletes a service. Prefer is_active=false instead.
 */
const deleteService = async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid service ID.' });
  }

  try {
    const deleted = await cleaningService.deleteService(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: `Service not found: ${id}` });
    }
    return res.status(200).json({ success: true, message: 'Service deleted.' });
  } catch (err) {
    // FK violation if requests reference this service
    if (err.code === '23503') {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete: existing cleaning requests reference this service. Deactivate it instead.',
      });
    }
    return handleError(res, err, 'deleteService');
  }
};

// ─── CLEANERS — ADMIN ─────────────────────────────────────────────────────────

/**
 * GET /api/cleaners
 * Admin: all cleaners. Customers cannot access this list.
 */
const getCleaners = async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  try {
    const cleaners = await cleaningService.getAllCleaners();
    return res.status(200).json({ success: true, count: cleaners.length, data: cleaners });
  } catch (err) {
    return handleError(res, err, 'getCleaners');
  }
};

/**
 * POST /api/cleaners
 * Admin: create a new cleaner.
 */
const createCleaner = async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const { name, phone, address, status } = req.body;

  const errors = [];
  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('name is required.');
  }
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    errors.push('phone is required.');
  }
  if (status && !cleaningService.VALID_CLEANER_STATUSES.includes(status)) {
    errors.push(`status must be one of: ${cleaningService.VALID_CLEANER_STATUSES.join(', ')}.`);
  }
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed.', errors });
  }

  try {
    const cleaner = await cleaningService.createCleaner({
      name: name.trim(),
      phone: phone.trim(),
      address: address?.trim() || null,
      status: status || 'AVAILABLE',
    });
    return res.status(201).json({ success: true, data: cleaner });
  } catch (err) {
    return handleError(res, err, 'createCleaner');
  }
};

/**
 * PATCH /api/cleaners/:id
 * Admin: update cleaner info or status.
 */
const updateCleaner = async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid cleaner ID.' });
  }

  if (req.body.status && !cleaningService.VALID_CLEANER_STATUSES.includes(req.body.status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${cleaningService.VALID_CLEANER_STATUSES.join(', ')}.`,
    });
  }

  const allowed = ['name', 'phone', 'address', 'status', 'is_active'];
  const fields = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) fields[key] = req.body[key];
  }

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields to update.' });
  }

  try {
    const updated = await cleaningService.updateCleaner(id, fields);
    if (!updated) {
      return res.status(404).json({ success: false, message: `Cleaner not found: ${id}` });
    }
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    return handleError(res, err, 'updateCleaner');
  }
};

// ─── CLEANING REQUESTS ────────────────────────────────────────────────────────

/**
 * POST /api/cleaning-requests
 * Authenticated customer creates a cleaning request.
 */
const createRequest = async (req, res) => {
  const {
    customer_name,
    customer_phone,
    service_id,
    location,
    preferred_date,
    preferred_time,
    notes,
  } = req.body;

  const errors = [];
  if (!customer_name || !String(customer_name).trim()) errors.push('customer_name is required.');
  if (!customer_phone || !String(customer_phone).trim()) errors.push('customer_phone is required.');
  if (!service_id) errors.push('service_id is required.');
  if (service_id && !isValidId(service_id)) errors.push('service_id must be a valid integer ID.');
  if (!location || !String(location).trim()) errors.push('location is required.');

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed.', errors });
  }

  try {
    const request = await cleaningService.createRequest({
      customer_name: String(customer_name).trim(),
      customer_phone: String(customer_phone).trim(),
      service_id,
      location: String(location).trim(),
      preferred_date: preferred_date || null,
      preferred_time: preferred_time || null,
      notes: notes?.trim() || null,
      user_id: req.user?.id || null,
    });
    return res.status(201).json({ success: true, data: request });
  } catch (err) {
    // FK violation — invalid service_id
    if (err.code === '23503') {
      return res.status(400).json({ success: false, message: 'Invalid service_id: service not found.' });
    }
    return handleError(res, err, 'createRequest');
  }
};

/**
 * GET /api/cleaning-requests/mine
 * Returns the current user's own cleaning requests.
 */
const getMyRequests = async (req, res) => {
  try {
    const requests = await cleaningService.getRequestsByUser(req.user.id);
    return res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (err) {
    return handleError(res, err, 'getMyRequests');
  }
};

/**
 * GET /api/cleaning-requests
 * Admin: all cleaning requests. Supports ?status=PENDING filter.
 */
const getAllRequests = async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const { status, service_id } = req.query;

  if (status && !cleaningService.VALID_REQUEST_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status filter. Must be one of: ${cleaningService.VALID_REQUEST_STATUSES.join(', ')}.`,
    });
  }

  try {
    const requests = await cleaningService.getAllRequests({ status, service_id });
    return res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (err) {
    return handleError(res, err, 'getAllRequests');
  }
};

/**
 * GET /api/cleaning-requests/:id
 * Owner or admin can view one request.
 */
const getRequest = async (req, res) => {
  const { id } = req.params;
  if (!isValidUUID(id)) {
    return res.status(400).json({ success: false, message: 'Invalid request ID.' });
  }

  try {
    const request = await cleaningService.getRequestById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: `Request not found: ${id}` });
    }

    // Enforce ownership: customer can only see their own
    if (!isAdmin(req) && request.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    return res.status(200).json({ success: true, data: request });
  } catch (err) {
    return handleError(res, err, 'getRequest');
  }
};

/**
 * PATCH /api/cleaning-requests/:id
 * Admin: update status and/or assign cleaner.
 */
const updateRequest = async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const { id } = req.params;
  if (!isValidUUID(id)) {
    return res.status(400).json({ success: false, message: 'Invalid request ID.' });
  }

  const { status, cleaner_id, notes } = req.body;

  if (status && !cleaningService.VALID_REQUEST_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${cleaningService.VALID_REQUEST_STATUSES.join(', ')}.`,
    });
  }

  if (cleaner_id !== undefined && cleaner_id !== null && !isValidId(cleaner_id)) {
    return res.status(400).json({ success: false, message: 'Invalid cleaner_id.' });
  }

  const fields = {};
  if (status !== undefined)     fields.status = status;
  if (cleaner_id !== undefined) fields.cleaner_id = cleaner_id;
  if (notes !== undefined)      fields.notes = notes;

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields to update.' });
  }

  try {
    const existing = await cleaningService.getRequestById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: `Request not found: ${id}` });
    }

    const updated = await cleaningService.updateRequest(id, fields);
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    return handleError(res, err, 'updateRequest');
  }
};

/**
 * PATCH /api/cleaning-requests/:id/cancel
 * Customer cancels their own PENDING request.
 */
const cancelRequest = async (req, res) => {
  const { id } = req.params;
  if (!isValidUUID(id)) {
    return res.status(400).json({ success: false, message: 'Invalid request ID.' });
  }

  try {
    const cancelled = await cleaningService.cancelRequest(id, req.user.id);
    return res.status(200).json({ success: true, data: cancelled });
  } catch (err) {
    return handleError(res, err, 'cancelRequest');
  }
};

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
  // Services
  getServices,
  getService,
  getServicesAdmin,
  createService,
  updateService,
  deleteService,
  // Cleaners
  getCleaners,
  createCleaner,
  updateCleaner,
  // Requests
  createRequest,
  getMyRequests,
  getAllRequests,
  getRequest,
  updateRequest,
  cancelRequest,
};
