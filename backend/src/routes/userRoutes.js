/**
 * userRoutes.js
 * Express router for /api/users endpoints (admin-facing customer list).
 *
 * Routes:
 *   GET /api/users → getUsers (admin only)
 */

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const { getUsers, deleteUser } = require('../controllers/userController');

// GET /api/users — all registered users (admin only)
router.get('/', authenticate, getUsers);

// DELETE /api/users/:id — permanently delete a user (admin only)
router.delete('/:id', authenticate, deleteUser);

module.exports = router;
