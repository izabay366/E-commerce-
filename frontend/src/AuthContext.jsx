import React, { createContext, useContext, useState, useEffect } from "react";
const AuthContext = createContext(null);
// Decodes the whole JWT payload, not just role — so if the backend embeds
// name/phone/email in the token, Checkout can prefill them without another
// round trip. Fields the token doesn't include just come back undefined.
export function decodeJwtPayload(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

// Reads a one-time token carried in the URL (used by AdminLayout's "View
// shop" link, since sessionStorage isn't reliably cloned into a new tab by
// every browser). If present, adopts it as this tab's session and strips it
// from the address bar immediately so it doesn't linger in history/bookmarks.
function adoptTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const viewToken = params.get("vt");
  if (!viewToken) return null;

  sessionStorage.setItem("token", viewToken);
  params.delete("vt");
  const query = params.toString();
  const cleanUrl = window.location.pathname + (query ? `?${query}` : "") + window.location.hash;
  window.history.replaceState({}, "", cleanUrl);

  return viewToken;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => adoptTokenFromUrl() || sessionStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    const t = adoptTokenFromUrl() || sessionStorage.getItem("token");
    return t ? decodeJwtPayload(t) : null;
  });
  useEffect(() => {
    if (token) {
      sessionStorage.setItem("token", token);
      setUser(decodeJwtPayload(token));
    } else {
      sessionStorage.removeItem("token");
      setUser(null);
    }
  }, [token]);
  const login = (newToken) => setToken(newToken);
  const logout = () => setToken(null);
  return (
    <AuthContext.Provider
      value={{
        token,
        role: user?.role || null,
        user,
        login,
        logout,
        isLoggedIn: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}
