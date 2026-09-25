import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, CheckCircle, AlertTriangle } from "lucide-react";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  // No token in URL — show error immediately
  if (!token) {
    return (
      <div className="min-h-screen bg-stone-50 font-sans flex items-center justify-center px-5">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-stone-200 p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-stone-900 mb-1">Invalid reset link</p>
          <p className="text-sm text-stone-500 mb-4">
            This link is missing a reset token. Please request a new one.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block bg-emerald-900 text-white text-sm font-medium px-5 h-10 leading-10 rounded-full hover:bg-emerald-800"
          >
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.message || "Something went wrong.");
      }
      setSuccess(true);
      // Auto-redirect to login after 3 seconds
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Password strength indicator
  const strength = (() => {
    if (!password) return null;
    if (password.length < 8) return { label: "Too short", color: "bg-red-400", width: "w-1/4" };
    if (password.length < 10) return { label: "Weak", color: "bg-amber-400", width: "w-2/4" };
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password))
      return { label: "Fair", color: "bg-yellow-400", width: "w-3/4" };
    return { label: "Strong", color: "bg-emerald-500", width: "w-full" };
  })();

  return (
    <div className="min-h-screen bg-stone-50 font-sans flex items-center justify-center px-5">
      <div className="w-full max-w-sm">

        <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-1 text-center">
          Set new password
        </h1>
        <p className="text-sm text-stone-400 text-center mb-6">
          Choose a strong password for your account
        </p>

        {success ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-stone-900 mb-1">Password updated!</p>
            <p className="text-sm text-stone-500 mb-4">
              Your password has been reset. Redirecting you to sign in…
            </p>
            <Link
              to="/login"
              className="inline-block bg-emerald-900 text-white text-sm font-medium px-5 h-10 leading-10 rounded-full hover:bg-emerald-800"
            >
              Sign in now
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-stone-200 p-6 space-y-3"
          >
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg p-3">
                {error}
              </div>
            )}

            {/* New password */}
            <div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password (min. 8 characters)"
                  autoFocus
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

              {/* Strength bar */}
              {strength && (
                <div className="mt-1.5">
                  <div className="h-1 w-full bg-stone-100 rounded-full overflow-hidden">
                    <div className={`h-1 rounded-full transition-all ${strength.color} ${strength.width}`} />
                  </div>
                  <p className="text-[11px] text-stone-400 mt-0.5">{strength.label}</p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <input
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              className="w-full h-10 px-3 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/30"
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-900 text-white font-medium h-11 rounded-full hover:bg-emerald-800 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Reset password"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-stone-400 mt-4">
          <Link to="/forgot-password" className="text-emerald-800 font-medium">
            Request a new link
          </Link>
        </p>
      </div>
    </div>
  );
}
