/**
 * authController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles: POST /api/auth/register
 *          POST /api/auth/login
 *          GET  /api/auth/me
 *
 * Security invariants:
 *   - password_hash NEVER appears in any HTTP response.
 *   - Passwords are hashed with bcrypt (saltRounds = 12) before storage.
 *   - JWT_SECRET is read from process.env only.
 *   - Login returns generic "Invalid credentials" — never reveals whether
 *     the email exists, preventing user enumeration.
 *   - Input is validated and sanitised before any DB operation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const bcrypt      = require('bcryptjs');
const jwt         = require('jsonwebtoken');
const authService = require('../services/authService');

const BCRYPT_SALT_ROUNDS = 12;
const JWT_EXPIRES_IN     = process.env.JWT_EXPIRES_IN || '7d';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Basic email format check — not a full RFC validator, but catches obvious errors. */
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Signs a JWT for the given user.
 * Payload: { userId, email, role } — minimal, stable claims only.
 */
function signToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────

/**
 * Creates a new user account.
 *
 * Required body fields:
 *   first_name  string
 *   phone       string  — must be unique
 *   email       string  — must be unique, used for login
 *   password    string  — min 8 chars; stored as bcrypt hash only
 *
 * Optional body fields:
 *   last_name   string
 *
 * Responses:
 *   201  { message, user }            — success (no password_hash in user)
 *   400  { message, errors? }         — validation failure
 *   409  { message }                  — duplicate email or phone
 *   500  { message }                  — unexpected error
 */
const register = async (req, res) => {
  const { first_name, last_name, phone, email, password } = req.body;

  // ── Validation ─────────────────────────────────────────────────────────────
  const errors = [];

  if (!first_name || typeof first_name !== 'string' || !first_name.trim()) {
    errors.push('first_name is required.');
  }
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    errors.push('phone is required.');
  }
  if (!email || !isValidEmail(email)) {
    errors.push('A valid email address is required.');
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    errors.push('password is required and must be at least 8 characters.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: 'Validation failed.', errors });
  }

  try {
    // ── Duplicate checks ─────────────────────────────────────────────────────
    const existingEmail = await authService.findUserByEmail(email);
    if (existingEmail) {
      return res.status(409).json({
        message: 'An account with this email address already exists.',
      });
    }

    const existingPhone = await authService.phoneExists(phone);
    if (existingPhone) {
      return res.status(409).json({
        message: 'An account with this phone number already exists.',
      });
    }

    // ── Hash password — NEVER store plaintext ─────────────────────────────────
    const password_hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // ── Insert user — RETURNING excludes password_hash ────────────────────────
    const user = await authService.createUser({
      first_name,
      last_name: last_name || null,
      phone,
      email,
      password_hash,
    });

    return res.status(201).json({
      message: 'Account created successfully.',
      user,
    });

  } catch (err) {
    // Fallback: catch DB unique violations that slipped past pre-checks
    if (err.code === '23505') {
      if (err.constraint && err.constraint.includes('email')) {
        return res.status(409).json({
          message: 'An account with this email address already exists.',
        });
      }
      if (err.constraint && err.constraint.includes('phone')) {
        return res.status(409).json({
          message: 'An account with this phone number already exists.',
        });
      }
      return res.status(409).json({ message: 'An account with these details already exists.' });
    }

    console.error('[register] Unexpected error:', err.message);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
};

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

/**
 * Authenticates a user and issues a JWT.
 *
 * Required body:
 *   email     string
 *   password  string
 *
 * Responses:
 *   200  { message, token, user }   — success (no password_hash in user)
 *   400  { message }               — missing fields
 *   401  { message }               — invalid credentials (generic — no email enumeration)
 *   500  { message }               — unexpected error
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ message: 'A valid email address is required.' });
  }
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ message: 'Password is required.' });
  }

  try {
    // ── Look up user including hash — ONLY for bcrypt comparison ──────────────
    const userWithHash = await authService.findUserByEmailWithHash(email);

    // Generic message — do NOT reveal whether the email is registered
    const INVALID_MSG = 'Invalid email or password.';

    if (!userWithHash) {
      return res.status(401).json({ message: INVALID_MSG });
    }

    // ── Compare password ──────────────────────────────────────────────────────
    if (!userWithHash.password_hash) {
      // Account exists but has no password (e.g. social login — not yet supported)
      return res.status(401).json({ message: INVALID_MSG });
    }

    const passwordMatch = await bcrypt.compare(password, userWithHash.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: INVALID_MSG });
    }

    // ── Build safe user object (strip password_hash) ──────────────────────────
    const { password_hash: _omit, ...safeUser } = userWithHash;

    // ── Sign JWT ──────────────────────────────────────────────────────────────
    const token = signToken(safeUser);

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: safeUser,
    });

  } catch (err) {
    console.error('[login] Unexpected error:', err.message);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

/**
 * Returns the currently authenticated user's profile.
 * Requires authenticate middleware — req.user is already set and safe.
 *
 * Responses:
 *   200  { user }   — safe user object (no password_hash)
 *   401            — handled by authenticate middleware before this runs
 */
const me = async (req, res) => {
  // req.user is attached by authenticate middleware — already safe (no hash)
  return res.status(200).json({ user: req.user });
};

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = { register, login, me };
