/**
 * cleaningService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All PostgreSQL queries for the Cleaning Services module.
 *
 * LIVE SCHEMA (after Phase 3 migration):
 *
 * cleaning_services:
 *   id                 UUID    PK DEFAULT uuid_generate_v4()
 *   name               VARCHAR(150) nullable
 *   description        TEXT nullable
 *   base_price         DECIMAL(12,2) nullable
 *   estimated_duration VARCHAR(100) nullable
 *   is_active          BOOLEAN NOT NULL DEFAULT TRUE  ← added Phase 3
 *
 * cleaners:
 *   id       UUID PK
 *   name     VARCHAR(150) nullable
 *   phone    VARCHAR(20)  nullable
 *   address  TEXT nullable
 *   status   VARCHAR(50)  nullable  (no DB CHECK — validated at app layer)
 *   is_active BOOLEAN NOT NULL DEFAULT TRUE  ← added Phase 3
 *
 * cleaning_requests:
 *   id             UUID PK
 *   customer_name  VARCHAR(150) nullable
 *   customer_phone VARCHAR(20)  nullable
 *   service_id     UUID nullable FK → cleaning_services.id
 *   cleaner_id     UUID nullable FK → cleaners.id  (NULL = unassigned)
 *   location       TEXT nullable
 *   preferred_date DATE nullable
 *   preferred_time TIME nullable
 *   price          DECIMAL(12,2) nullable
 *   status         VARCHAR(50)  nullable  (no DB CHECK — validated at app layer)
 *   notes          TEXT nullable  ← added Phase 3
 *   user_id        UUID nullable FK → users.id ON DELETE SET NULL  ← added Phase 3
 *   created_at     TIMESTAMP DEFAULT NOW()
 *   updated_at     TIMESTAMP NOT NULL DEFAULT NOW()  ← added Phase 3
 *
 * BUSINESS RULES:
 *   - Status values (no DB constraint, enforced here):
 *     PENDING → CONFIRMED → IN_PROGRESS → COMPLETED → CANCELLED
 *   - Cleaner status values: AVAILABLE, BUSY, INACTIVE
 *   - Only ADMIN can update status or assign cleaners.
 *   - Customers can cancel only PENDING requests.
 *   - is_active=false hides services/cleaners from customers without deleting data.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const pool = require('../config/database');

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────

const VALID_REQUEST_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const VALID_CLEANER_STATUSES = ['AVAILABLE', 'BUSY', 'INACTIVE'];
const CUSTOMER_CANCELLABLE_STATUSES = ['PENDING']; // Only admins can cancel anything else

// ─── FORMAT HELPERS ────────────────────────────────────────────────────────────

function formatService(row) {
  return {
    id:                 row.id,
    name:               row.name,
    description:        row.description,
    base_price:         row.base_price !== null ? parseFloat(row.base_price) : null,
    estimated_duration: row.estimated_duration,
    is_active:          row.is_active,
  };
}

function formatCleaner(row) {
  return {
    id:        row.id,
    name:      row.name,
    phone:     row.phone,
    address:   row.address,
    status:    row.status,
    is_active: row.is_active,
  };
}

function formatRequest(row) {
  return {
    id:             row.id,
    customer_name:  row.customer_name,
    customer_phone: row.customer_phone,
    service_id:     row.service_id,
    service_name:   row.service_name || null,
    cleaner_id:     row.cleaner_id,
    cleaner_name:   row.cleaner_name || null,
    location:       row.location,
    preferred_date: row.preferred_date,
    preferred_time: row.preferred_time,
    price:          row.price !== null ? parseFloat(row.price) : null,
    status:         row.status,
    notes:          row.notes,
    user_id:        row.user_id,
    created_at:     row.created_at,
    updated_at:     row.updated_at,
  };
}

// ─── CLEANING SERVICES ─────────────────────────────────────────────────────────

/**
 * Returns all active cleaning services (customer-facing).
 * @returns {object[]}
 */
const getAllServices = async () => {
  const result = await pool.query(
    `SELECT id, name, description, base_price, estimated_duration, is_active
     FROM cleaning_services
     WHERE is_active = TRUE
     ORDER BY name ASC`
  );
  return result.rows.map(formatService);
};

/**
 * Returns ALL cleaning services including inactive (admin-facing).
 * @returns {object[]}
 */
const getAllServicesAdmin = async () => {
  const result = await pool.query(
    `SELECT id, name, description, base_price, estimated_duration, is_active
     FROM cleaning_services
     ORDER BY is_active DESC, name ASC`
  );
  return result.rows.map(formatService);
};

/**
 * Returns one service by UUID, or null.
 * @param {string} serviceId UUID
 */
const getServiceById = async (serviceId) => {
  const result = await pool.query(
    `SELECT id, name, description, base_price, estimated_duration, is_active
     FROM cleaning_services
     WHERE id = $1`,
    [serviceId]
  );
  return result.rows[0] ? formatService(result.rows[0]) : null;
};

/**
 * Creates a new cleaning service.
 * @param {{ name, description, base_price, estimated_duration }} data
 */
const createService = async ({ name, description, base_price, estimated_duration }) => {
  const result = await pool.query(
    `INSERT INTO cleaning_services (name, description, base_price, estimated_duration)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, description, base_price, estimated_duration, is_active`,
    [name, description || null, base_price !== undefined ? base_price : null, estimated_duration || null]
  );
  return formatService(result.rows[0]);
};

/**
 * Updates an existing cleaning service. Only supplied fields are changed.
 * @param {string} serviceId UUID
 * @param {{ name?, description?, base_price?, estimated_duration?, is_active? }} fields
 */
const updateService = async (serviceId, fields) => {
  const setParts = [];
  const values = [];
  let i = 1;

  if (fields.name !== undefined)               { setParts.push(`name = $${i++}`);               values.push(fields.name); }
  if (fields.description !== undefined)        { setParts.push(`description = $${i++}`);        values.push(fields.description); }
  if (fields.base_price !== undefined)         { setParts.push(`base_price = $${i++}`);         values.push(fields.base_price); }
  if (fields.estimated_duration !== undefined) { setParts.push(`estimated_duration = $${i++}`); values.push(fields.estimated_duration); }
  if (fields.is_active !== undefined)          { setParts.push(`is_active = $${i++}`);          values.push(fields.is_active); }

  if (setParts.length === 0) return null; // nothing to update

  values.push(serviceId);
  const result = await pool.query(
    `UPDATE cleaning_services SET ${setParts.join(', ')}
     WHERE id = $${i}
     RETURNING id, name, description, base_price, estimated_duration, is_active`,
    values
  );
  return result.rows[0] ? formatService(result.rows[0]) : null;
};

/**
 * Deletes a cleaning service. Returns true if deleted, false if not found.
 * @param {string} serviceId UUID
 */
const deleteService = async (serviceId) => {
  const result = await pool.query(
    `DELETE FROM cleaning_services WHERE id = $1 RETURNING id`,
    [serviceId]
  );
  return result.rows.length > 0;
};

// ─── CLEANERS ─────────────────────────────────────────────────────────────────

/**
 * Returns all active cleaners (customer-facing — used when booking).
 */
const getActiveCleaners = async () => {
  const result = await pool.query(
    `SELECT id, name, phone, address, status, is_active
     FROM cleaners
     WHERE is_active = TRUE
     ORDER BY name ASC`
  );
  return result.rows.map(formatCleaner);
};

/**
 * Returns ALL cleaners including inactive (admin-facing).
 */
const getAllCleaners = async () => {
  const result = await pool.query(
    `SELECT id, name, phone, address, status, is_active
     FROM cleaners
     ORDER BY is_active DESC, name ASC`
  );
  return result.rows.map(formatCleaner);
};

/**
 * Returns one cleaner by UUID, or null.
 */
const getCleanerById = async (cleanerId) => {
  const result = await pool.query(
    `SELECT id, name, phone, address, status, is_active
     FROM cleaners WHERE id = $1`,
    [cleanerId]
  );
  return result.rows[0] ? formatCleaner(result.rows[0]) : null;
};

/**
 * Creates a new cleaner.
 */
const createCleaner = async ({ name, phone, address, status }) => {
  const result = await pool.query(
    `INSERT INTO cleaners (name, phone, address, status)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, phone, address, status, is_active`,
    [name, phone || null, address || null, status || 'AVAILABLE']
  );
  return formatCleaner(result.rows[0]);
};

/**
 * Updates an existing cleaner.
 */
const updateCleaner = async (cleanerId, fields) => {
  const setParts = [];
  const values = [];
  let i = 1;

  if (fields.name !== undefined)      { setParts.push(`name = $${i++}`);      values.push(fields.name); }
  if (fields.phone !== undefined)     { setParts.push(`phone = $${i++}`);     values.push(fields.phone); }
  if (fields.address !== undefined)   { setParts.push(`address = $${i++}`);   values.push(fields.address); }
  if (fields.status !== undefined)    { setParts.push(`status = $${i++}`);    values.push(fields.status); }
  if (fields.is_active !== undefined) { setParts.push(`is_active = $${i++}`); values.push(fields.is_active); }

  if (setParts.length === 0) return null;

  values.push(cleanerId);
  const result = await pool.query(
    `UPDATE cleaners SET ${setParts.join(', ')}
     WHERE id = $${i}
     RETURNING id, name, phone, address, status, is_active`,
    values
  );
  return result.rows[0] ? formatCleaner(result.rows[0]) : null;
};

// ─── CLEANING REQUESTS ─────────────────────────────────────────────────────────

/**
 * Returns all cleaning requests (admin).
 * Joins service name + cleaner name for display.
 */
const getAllRequests = async ({ status, service_id } = {}) => {
  const conditions = [];
  const values = [];
  let i = 1;

  if (status)     { conditions.push(`cr.status = $${i++}`);     values.push(status); }
  if (service_id) { conditions.push(`cr.service_id = $${i++}`); values.push(service_id); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT
       cr.*,
       cs.name AS service_name,
       cl.name AS cleaner_name
     FROM cleaning_requests cr
     LEFT JOIN cleaning_services cs ON cs.id = cr.service_id
     LEFT JOIN cleaners cl ON cl.id = cr.cleaner_id
     ${where}
     ORDER BY cr.created_at DESC`,
    values
  );
  return result.rows.map(formatRequest);
};

/**
 * Returns all requests for a specific customer (by user_id).
 * @param {string} userId UUID
 */
const getRequestsByUser = async (userId) => {
  const result = await pool.query(
    `SELECT
       cr.*,
       cs.name AS service_name,
       cl.name AS cleaner_name
     FROM cleaning_requests cr
     LEFT JOIN cleaning_services cs ON cs.id = cr.service_id
     LEFT JOIN cleaners cl ON cl.id = cr.cleaner_id
     WHERE cr.user_id = $1
     ORDER BY cr.created_at DESC`,
    [userId]
  );
  return result.rows.map(formatRequest);
};

/**
 * Returns one cleaning request by UUID.
 * Includes service + cleaner names.
 */
const getRequestById = async (requestId) => {
  const result = await pool.query(
    `SELECT
       cr.*,
       cs.name AS service_name,
       cl.name AS cleaner_name
     FROM cleaning_requests cr
     LEFT JOIN cleaning_services cs ON cs.id = cr.service_id
     LEFT JOIN cleaners cl ON cl.id = cr.cleaner_id
     WHERE cr.id = $1`,
    [requestId]
  );
  return result.rows[0] ? formatRequest(result.rows[0]) : null;
};

/**
 * Creates a new cleaning request.
 * Price is copied from cleaning_services.base_price at booking time (snapshot).
 *
 * @param {{ customer_name, customer_phone, service_id, location,
 *            preferred_date, preferred_time, notes, user_id }} data
 */
const createRequest = async ({
  customer_name,
  customer_phone,
  service_id,
  location,
  preferred_date,
  preferred_time,
  notes,
  user_id,
}) => {
  // Snapshot the base_price from the service at booking time
  let price = null;
  if (service_id) {
    const svcResult = await pool.query(
      `SELECT base_price FROM cleaning_services WHERE id = $1 AND is_active = TRUE`,
      [service_id]
    );
    if (svcResult.rows[0]) {
      price = svcResult.rows[0].base_price;
    }
  }

  const result = await pool.query(
    `INSERT INTO cleaning_requests
       (customer_name, customer_phone, service_id, location,
        preferred_date, preferred_time, price, status, notes, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, $9)
     RETURNING *`,
    [
      customer_name,
      customer_phone,
      service_id || null,
      location || null,
      preferred_date || null,
      preferred_time || null,
      price,
      notes || null,
      user_id || null,
    ]
  );

  // Fetch the formatted version with joined names
  return getRequestById(result.rows[0].id);
};

/**
 * Updates status and/or cleaner assignment for a request (admin only).
 * @param {string} requestId UUID
 * @param {{ status?, cleaner_id? }} fields
 */
const updateRequest = async (requestId, fields) => {
  const setParts = [];
  const values = [];
  let i = 1;

  if (fields.status !== undefined)     { setParts.push(`status = $${i++}`);     values.push(fields.status); }
  if (fields.cleaner_id !== undefined) { setParts.push(`cleaner_id = $${i++}`); values.push(fields.cleaner_id); }
  if (fields.notes !== undefined)      { setParts.push(`notes = $${i++}`);      values.push(fields.notes); }

  // Always update updated_at
  setParts.push(`updated_at = NOW()`);

  if (setParts.length <= 1) return null; // nothing but updated_at

  values.push(requestId);
  await pool.query(
    `UPDATE cleaning_requests SET ${setParts.join(', ')} WHERE id = $${i}`,
    values
  );

  return getRequestById(requestId);
};

/**
 * Customer cancels their own request.
 * Only allowed when status = 'PENDING'.
 * Returns { success, message, request } or throws an error with .statusCode.
 * @param {string} requestId UUID
 * @param {string} userId UUID — the authenticated user
 */
const cancelRequest = async (requestId, userId) => {
  const req = await getRequestById(requestId);

  if (!req) {
    const err = new Error('Cleaning request not found.');
    err.statusCode = 404;
    throw err;
  }

  if (req.user_id !== userId) {
    const err = new Error('You can only cancel your own requests.');
    err.statusCode = 403;
    throw err;
  }

  if (!CUSTOMER_CANCELLABLE_STATUSES.includes(req.status)) {
    const err = new Error(
      `Cannot cancel a request with status '${req.status}'. Only PENDING requests can be cancelled by customers.`
    );
    err.statusCode = 409;
    throw err;
  }

  await pool.query(
    `UPDATE cleaning_requests
     SET status = 'CANCELLED', updated_at = NOW()
     WHERE id = $1`,
    [requestId]
  );

  return getRequestById(requestId);
};

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
  // Services
  getAllServices,
  getAllServicesAdmin,
  getServiceById,
  createService,
  updateService,
  deleteService,
  // Cleaners
  getActiveCleaners,
  getAllCleaners,
  getCleanerById,
  createCleaner,
  updateCleaner,
  // Requests
  getAllRequests,
  getRequestsByUser,
  getRequestById,
  createRequest,
  updateRequest,
  cancelRequest,
  // Constants (exported for use in controller/tests)
  VALID_REQUEST_STATUSES,
  VALID_CLEANER_STATUSES,
};
