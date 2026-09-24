import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import { STATUS_LABEL } from "./orderStatus";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const POLL_INTERVAL_MS = 45000;

const NotificationsContext = createContext(null);

// Per-account (never shared across accounts on the same browser — same fix
// as the Account/Checkout saved-address bug). Guests get no key at all,
// since order status tracking requires being logged in on this backend.
function seenStatusesKey(userId) {
  return `muhangashop_seen_order_statuses:${userId}`;
}

function loadSeenStatuses(userId) {
  try {
    return JSON.parse(localStorage.getItem(seenStatusesKey(userId)) || "{}");
  } catch {
    return {};
  }
}

function saveSeenStatuses(userId, statuses) {
  try {
    localStorage.setItem(seenStatusesKey(userId), JSON.stringify(statuses));
  } catch {
    // Best-effort only.
  }
}

export function NotificationsProvider({ children }) {
  const { isLoggedIn, token, user } = useAuth();
  const [notifications, setNotifications] = useState([]); // [{ orderId, status, at }]
  const intervalRef = useRef(null);

  const checkForUpdates = useCallback(async () => {
    if (!isLoggedIn || !token || !user?.userId) return;

    try {
      const res = await fetch(`${API_URL}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return; // stay quiet — this is a background poll, not a user action
      const body = await res.json();
      const orders = body.data || [];

      const seen = loadSeenStatuses(user.userId);
      const nextSeen = { ...seen };
      const newNotifications = [];

      for (const order of orders) {
        const previousStatus = seen[order.id];
        if (previousStatus !== order.status) {
          // Skip the very first time we ever see an order — otherwise every
          // existing order would "notify" the moment someone logs in.
          if (previousStatus !== undefined) {
            newNotifications.push({
              orderId: order.id,
              status: order.status,
              at: new Date().toISOString(),
            });
          }
          nextSeen[order.id] = order.status;
        }
      }

      if (newNotifications.length > 0) {
        setNotifications((prev) => [...newNotifications, ...prev].slice(0, 20));
      }
      saveSeenStatuses(user.userId, nextSeen);
    } catch {
      // Silent — this is a background poll; a transient network hiccup
      // shouldn't surface as an error anywhere in the UI.
    }
  }, [isLoggedIn, token, user?.userId]);

  useEffect(() => {
    if (!isLoggedIn) {
      setNotifications([]);
      return;
    }

    checkForUpdates(); // once immediately on login
    intervalRef.current = setInterval(checkForUpdates, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [isLoggedIn, checkForUpdates]);

  const clearNotifications = useCallback(() => setNotifications([]), []);

  return (
    <NotificationsContext.Provider value={{ notifications, clearNotifications, unreadCount: notifications.length }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside a NotificationsProvider");
  return ctx;
}

export { STATUS_LABEL };
