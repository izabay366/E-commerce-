/**
 * authenticate.js
 * ─────────────────────────────────────────────────────────────────────────────
 * JWT Bearer token middleware for protected routes.
 *
 * Usage:
 *   const authenticate = require('../middleware/authenticate');
 *   router.get('/me', authenticate, meController);
 *
 * On success:  attaches safe user object to req.user and calls next().
 * On failure:  returns HTTP 401 — never 500 for auth failures.
 *
 * Security:
 *   - password_hash is NEVER included in req.user.
 *   - Fetches a fresh user row on every request so revoked/deleted
 *     accounts are rejected even if token is still valid.
 *   - JWT_SECRET is read from process.env — never hard-coded.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const jwt  = require('jsonwebtoken');
const pool = require('../config/database');

/**
 * Verifies the Bearer token in the Authorization header.
 * Attaches { id, first_name, last_name, phone, email, role, created_at, updated_at }
 * to req.user on success.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function authenticate(req, res, next) {
  // ── 1. Extract Bearer token ───────────────────────────────────────────────
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Authentication required. Provide a valid Bearer token.',
    });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is missing.' });
  }

  // ── 2. Verify JWT signature and expiry ───────────────────────────────────
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired. Please log in again.' });
    }
    return res.status(401).json({ message: 'Invalid token.' });
  }

  if (!decoded.userId) {
    return res.status(401).json({ message: 'Invalid token payload.' });
  }

  // ── 3. Fetch fresh user from DB — never trust stale token payload ─────────
  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, phone, email, role, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'User account not found.' });
    }

    // Attach safe user — password_hash is NOT selected above
    req.user = result.rows[0];
    return next();

  } catch (err) {
    console.error('[authenticate] DB error:', err.message);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
}

module.exports = authenticate;
