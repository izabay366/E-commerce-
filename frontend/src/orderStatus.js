/**
 * orderStatus.js
 * Shared order-status constants, matching the backend's actual CHECK
 * constraint exactly (all uppercase — confirmed via orderController.js).
 * Used by AdminOrders.jsx, TrackOrder.jsx, and NotificationsContext.jsx so
 * they can't drift out of sync with each other or with the backend.
 */

export const STATUS_FLOW = ["PENDING", "CONFIRMED", "PROCESSING", "OUT_FOR_DELIVERY", "DELIVERED"];

export const STATUS_LABEL = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const STATUS_COLOR = {
  PENDING: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-blue-50 text-blue-700",
  PROCESSING: "bg-blue-50 text-blue-700",
  OUT_FOR_DELIVERY: "bg-blue-50 text-blue-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-red-50 text-red-700",
};
