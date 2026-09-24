/**
 * offerRoutes.js
 * Express router for all /api/offers endpoints.
 *
 * Routes:
 *   GET    /api/offers      â†’ getOffers    (all active offers)
 *   POST   /api/offers      â†’ createOffer  (admin only)
 *   PUT    /api/offers/:id  â†’ updateOffer  (admin only)
 *   DELETE /api/offers/:id  â†’ deleteOffer  (admin only)
 */

const express  = require('express');
const router   = express.Router();
const authenticate = require('../middleware/authenticate');
const {
  getOffers,
  createOffer,
  updateOffer,
  deleteOffer,
} = require('../controllers/offerController');

// GET /api/offers â€” all active offers, shown on the homepage banner
router.get('/', getOffers);

// POST /api/offers â€” create an offer (admin only)
router.post('/', authenticate, createOffer);

// PUT /api/offers/:id â€” update an offer (admin only)
router.put('/:id', authenticate, updateOffer);

// DELETE /api/offers/:id â€” soft-delete an offer (admin only)
router.delete('/:id', authenticate, deleteOffer);

module.exports = router;
