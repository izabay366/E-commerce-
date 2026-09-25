import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.message || "Something went wrong.");
      }
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans flex items-center justify-center px-5">
      <div className="w-full max-w-sm">

        {/* Back link */}
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-emerald-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to sign in
        </Link>

        {/* Brand */}
        <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-1 text-center">
          Forgot password?
        </h1>
        <p className="text-sm text-stone-400 text-center mb-6">
          Enter your email and we'll send you a reset link
        </p>

        {/* Success state */}
        {sent ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-stone-900 mb-1">Check your email</p>
            <p className="text-sm text-stone-500 mb-4">
              If <strong>{email}</strong> is registered, you'll receive a reset link within a minute.
              Check your spam folder if you don't see it.
            </p>
            <Link
              to="/login"
              className="inline-block bg-emerald-900 text-white text-sm font-medium px-5 h-10 leading-10 rounded-full hover:bg-emerald-800"
            >
              Back to sign in
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

            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                autoFocus
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/30"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-900 text-white font-medium h-11 rounded-full hover:bg-emerald-800 disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-stone-400 mt-4">
          Remember your password?{" "}
          <Link to="/login" className="text-emerald-800 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
