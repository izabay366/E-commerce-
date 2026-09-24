import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const { token, isLoggedIn } = useAuth();
  const [favorites, setFavorites] = useState([]); // full favorite objects (product details included)
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!isLoggedIn) {
      setFavorites([]);
      return;
    }
    setLoading(true);
    fetch(`${API_URL}/api/favorites`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setFavorites(data.data || []))
      .catch(() => setFavorites([]))
      .finally(() => setLoading(false));
  }, [token, isLoggedIn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isFavorited = (productId) => favorites.some((f) => f.product_id === productId);

  const toggleFavorite = async (productId) => {
    if (!isLoggedIn) {
      // Caller (heart button) should redirect to /login in this case —
      // favorites require an account, same limitation as My Orders.
      throw new Error("Sign in to save favorites.");
    }

    if (isFavorited(productId)) {
      await fetch(`${API_URL}/api/favorites/${productId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } else {
      await fetch(`${API_URL}/api/favorites`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ product_id: productId }),
      });
    }
    refresh();
  };

  return (
    <FavoritesContext.Provider value={{ favorites, loading, isFavorited, toggleFavorite, refresh }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used inside a FavoritesProvider");
  return ctx;
}
