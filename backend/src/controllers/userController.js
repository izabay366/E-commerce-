/**
 * userController.js
 * Handles HTTP request/response for admin-facing user/customer endpoints.
 * Delegates all database work to authService (same table, same safe columns
 * used everywhere else — no password_hash is ever selected here).
 */

const authService = require('../services/authService');

// ─── GET ALL USERS ─────────────────────────────────────────────────────────────

/**
 * GET /api/users
 * Admin only. Returns every registered user (customers and admins alike),
 * newest first. No password_hash is ever included.
 */
const getUsers = async (req, res) => {
  // Role check is case-insensitive — tokens/DB store role as 'ADMIN' (uppercase).
  if (!req.user || req.user.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  try {
    const users = await authService.getAllUsers();
    return res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error('Error fetching users:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve users.',
    });
  }
};

// ─── DELETE USER ────────────────────────────────────────────────────────────────

/**
 * DELETE /api/users/:id
 * Admin only. Permanently deletes a user account. An admin can't delete
 * their own currently-logged-in account (that would lock them out).
 */
const deleteUser = async (req, res) => {
  // Role check is case-insensitive — tokens/DB store role as 'ADMIN' (uppercase).
  if (!req.user || req.user.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const { id } = req.params;

  if (id === req.user.id) {
    return res.status(400).json({
      success: false,
      message: "You can't delete your own account while logged in as it.",
    });
  }

  try {
    const deleted = await authService.deleteUser(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: `User not found with ID: ${id}` });
    }
    return res.status(200).json({ success: true, message: 'User deleted.' });
  } catch (error) {
    console.error(`Error deleting user ${id}:`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user.',
    });
  }
};

module.exports = { getUsers, deleteUser };
