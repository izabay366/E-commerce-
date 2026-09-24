import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const SESSION_KEY = "muhangashop_session_token";

const CartContext = createContext(null);

function getOrCreateSessionToken() {
  let token = localStorage.getItem(SESSION_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, token);
  }
  return token;
}

export function CartProvider({ children }) {
  const { token: authToken } = useAuth();
  const [cart, setCart] = useState(null); // { id, items, subtotal, total_items }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Runs on mount AND whenever login state changes. Logging in re-sends this
  // with the auth token attached, which makes the backend attach/merge this
  // browser's guest cart into the account's own cart — see
  // cartService.findOrCreateCartForRequest. Logging out re-runs it without
  // the token, falling back to plain session-token lookup (same cart row,
  // since its session_token doesn't change when it gets attached to a user).
  useEffect(() => {
    const sessionToken = getOrCreateSessionToken();
    setLoading(true);

    fetch(`${API_URL}/api/cart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ session_token: sessionToken }),
    })
      .then((res) => res.json())
      .then((data) => setCart(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [authToken]);

  const refreshCart = useCallback(() => {
    if (!cart?.id) return;
    fetch(`${API_URL}/api/cart/${cart.id}`)
      .then((res) => res.json())
      .then((data) => setCart(data))
      .catch((err) => setError(err.message));
  }, [cart?.id]);

  const addItem = useCallback(
    async (variantId, quantity = 1) => {
      if (!cart?.id) return;
      try {
        const res = await fetch(`${API_URL}/api/cart/${cart.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variant_id: variantId, quantity }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `Failed to add item (${res.status})`);
        }
        refreshCart();
      } catch (err) {
        setError(err.message);
        throw err; // let the calling component show its own inline error if it wants
      }
    },
    [cart?.id, refreshCart]
  );

  const updateItemQuantity = useCallback(
    async (itemId, quantity) => {
      if (!cart?.id) return;
      const res = await fetch(`${API_URL}/api/cart/${cart.id}/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      if (!res.ok) throw new Error("Failed to update quantity");
      refreshCart();
    },
    [cart?.id, refreshCart]
  );

  const removeItem = useCallback(
    async (itemId) => {
      if (!cart?.id) return;
      const res = await fetch(`${API_URL}/api/cart/${cart.id}/items/${itemId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove item");
      refreshCart();
    },
    [cart?.id, refreshCart]
  );

  const clearCart = useCallback(async () => {
    if (!cart?.id) return;
    const res = await fetch(`${API_URL}/api/cart/${cart.id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to clear cart");
    refreshCart();
  }, [cart?.id, refreshCart]);

  const itemCount = cart?.total_items || 0;

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        error,
        itemCount,
        addItem,
        updateItemQuantity,
        removeItem,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside a CartProvider");
  return ctx;
}
