/**
 * offerController.js
 * Handles HTTP request/response for all offer endpoints.
 * Delegates all database work to offerService.
 */

const offerService = require('../services/offerService');

// â”€â”€â”€ GET ALL OFFERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * GET /api/offers
 * Returns all active offers, for the homepage banner and the admin list.
 */
const getOffers = async (req, res) => {
  try {
    const offers = await offerService.getAllOffers();

    return res.status(200).json({
      success: true,
      count:   offers.length,
      data:    offers,
    });
  } catch (error) {
    console.error('Error fetching offers:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve offers.',
      error:   error.message,
    });
  }
};

// â”€â”€â”€ CREATE OFFER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * POST /api/offers
 * Admin only. Creates a new offer.
 * Body: { title, subtitle?, code?, icon?, highlight?, sort_order? }
 */
const createOffer = async (req, res) => {
  if (!req.user || req.user.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const { title, subtitle, code, icon, highlight, sort_order } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({
      success: false,
      message: 'title is required.',
    });
  }

  try {
    const offer = await offerService.createOffer({
      title: title.trim(),
      subtitle,
      code,
      icon,
      highlight,
      sort_order,
    });

    return res.status(201).json({
      success: true,
      data: offer,
    });
  } catch (error) {
    console.error('Error creating offer:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create offer.',
      error: error.message,
    });
  }
};

// â”€â”€â”€ UPDATE OFFER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * PUT /api/offers/:id
 * Admin only. Updates an offer's fields.
 * Body: { title, subtitle?, code?, icon?, highlight?, sort_order? }
 */
const updateOffer = async (req, res) => {
  if (!req.user || req.user.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const offerId = parseInt(req.params.id, 10);
  if (isNaN(offerId) || offerId <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid offer ID.' });
  }

  const { title, subtitle, code, icon, highlight, sort_order } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({
      success: false,
      message: 'title is required.',
    });
  }

  try {
    const offer = await offerService.updateOffer(offerId, {
      title: title.trim(),
      subtitle,
      code,
      icon,
      highlight,
      sort_order,
    });

    if (!offer) {
      return res.status(404).json({ success: false, message: `Offer not found with ID: ${offerId}` });
    }

    return res.status(200).json({
      success: true,
      data: offer,
    });
  } catch (error) {
    console.error(`Error updating offer ${offerId}:`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update offer.',
      error: error.message,
    });
  }
};

// â”€â”€â”€ DELETE OFFER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * DELETE /api/offers/:id
 * Admin only. Soft-deletes the offer (is_active = FALSE).
 */
const deleteOffer = async (req, res) => {
  if (!req.user || req.user.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const offerId = parseInt(req.params.id, 10);
  if (isNaN(offerId) || offerId <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid offer ID.' });
  }

  try {
    const deleted = await offerService.softDeleteOffer(offerId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: `Offer not found with ID: ${offerId}` });
    }
    return res.status(200).json({ success: true, message: 'Offer deleted.' });
  } catch (error) {
    console.error(`Error deleting offer ${offerId}:`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete offer.',
      error: error.message,
    });
  }
};

module.exports = {
  getOffers,
  createOffer,
  updateOffer,
  deleteOffer,
};
