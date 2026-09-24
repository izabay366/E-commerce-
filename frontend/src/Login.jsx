import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth, decodeJwtPayload } from "./AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Customers land here from a "Sign in" link and get sent back where they came from.
  // Admins hit this same form at /admin/login and get sent to the dashboard.
  const redirectTo = location.state?.from || null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Invalid email or password");
      }
      const data = await res.json();
      login(data.token);
      // Some backends only encode role inside the JWT, not in the response
      // body — decode the token itself so this works either way.
      const role = data.role || decodeJwtPayload(data.token)?.role;
      if (role?.toLowerCase() === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate(redirectTo || "/");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans flex items-center justify-center px-5">
      <div className="w-full max-w-sm">

        <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-1 text-center">Sign in</h1>
        <p className="text-sm text-stone-400 text-center mb-6">Track orders and check out faster</p>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-stone-200 p-6 space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg p-3">{error}</div>
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full h-10 px-3 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/30"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full h-10 pl-3 pr-10 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/30"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-900 text-white font-medium h-11 rounded-full hover:bg-emerald-800 disabled:opacity-50"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-stone-400 mt-4">
          New here? <Link to="/register" className="text-emerald-800 font-medium">Create an account</Link>
        </p>
        <p className="text-center text-sm text-stone-400 mt-2">
          <Link to="/" className="text-stone-500 underline">Continue as guest</Link>
        </p>
      </div>
    </div>

  );
}
