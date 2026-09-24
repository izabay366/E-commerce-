/**
 * favoriteRoutes.js
 * Express router for /api/favorites endpoints.
 * Every route requires a logged-in user — favorites are account-only.
 *
 * Routes:
 *   GET    /api/favorites              → getFavorites    (JWT required)
 *   POST   /api/favorites              → addFavorite      (JWT required)
 *   DELETE /api/favorites/:productId   → removeFavorite   (JWT required)
 */
'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const {
  getFavorites,
  addFavorite,
  removeFavorite,
} = require('../controllers/favoriteController');

router.get('/', authenticate, getFavorites);
router.post('/', authenticate, addFavorite);
router.delete('/:productId', authenticate, removeFavorite);

module.exports = router;
