/**
 * authRoutes.js
 * ─────────────────────────────────────────────────────────────
 * Routes:
 *   POST /api/auth/register          — create new account
 *   POST /api/auth/login             — authenticate + receive JWT
 *   POST /api/auth/forgot-password   — request password-reset email
 *   POST /api/auth/reset-password    — apply new password via token
 *   GET  /api/auth/me                — get current user (JWT required)
 *
 * Rate limiting (all per-IP):
 *   /login            — 5 attempts / 15 min  (bots get shut out fast)
 *   /register         — 5 accounts / 1 hour  (stops account spam)
 *   /forgot-password  — 3 requests / 15 min  (stops email bombing)
 *   /reset-password   — 5 requests / 15 min  (stops token brute-force)
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const express        = require('express');
const rateLimit      = require('express-rate-limit');
const authController = require('../controllers/authController');
const authenticate   = require('../middleware/authenticate');

const router = express.Router();

// Max 5 login attempts per IP per 15 minutes.
// Lowered from 10: a real user rarely needs more than 3 tries.
// skipSuccessfulRequests: true — successful logins don't burn the quota,
// only failed attempts count, so a user who types wrong 4 times then
// succeeds is not penalised for the final correct attempt.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
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

// Max 3 forgot-password requests per IP per 15 minutes — stops email bombing.
// Kept intentionally strict: a real user only needs to click once or twice.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Too many reset requests. Please wait a few minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Max 5 reset-password submissions per IP per 15 minutes — stops token
// brute-force. This counter is independent of the forgot-password counter.
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many reset attempts. Please wait a few minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public endpoints — no auth required, but individually rate-limited
router.post('/register',        registerLimiter,       authController.register);
router.post('/login',           loginLimiter,          authController.login);
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
router.post('/reset-password',  resetPasswordLimiter,  authController.resetPassword);

// Protected endpoint — JWT required
router.get('/me', authenticate, authController.me);

module.exports = router;

