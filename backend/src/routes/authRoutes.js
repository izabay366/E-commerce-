/**
 * authRoutes.js
 * ─────────────────────────────────────────────────────────────
 * Routes:
 *   POST /api/auth/register   — create new account
 *   POST /api/auth/login      — authenticate + receive JWT
 *   GET  /api/auth/me         — get current user (requires Bearer token)
 *
 * Rate limiting:
 *   /login and /register are limited per-IP to slow down brute-force
 *   password guessing and automated account creation.
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const express        = require('express');
const rateLimit      = require('express-rate-limit');
const authController = require('../controllers/authController');
const authenticate   = require('../middleware/authenticate');

const router = express.Router();

// Max 10 login attempts per IP per 15 minutes — generous enough for a
// real user who mistypes their password a few times, strict enough to
// make scripted brute-force guessing impractical.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Max 5 registrations per IP per hour — prevents automated account spam.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many accounts created from this connection. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Max 5 password-reset requests per IP per 15 minutes — prevents email spam
// while still letting a real user retry if their email didn't arrive.
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many reset requests. Please wait a few minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public endpoints — no auth required, but rate-limited
router.post('/register',         registerLimiter, authController.register);
router.post('/login',            loginLimiter,    authController.login);
router.post('/forgot-password',  resetLimiter,    authController.forgotPassword);
router.post('/reset-password',   resetLimiter,    authController.resetPassword);

// Protected endpoint — JWT required
router.get('/me', authenticate, authController.me);

module.exports = router;

