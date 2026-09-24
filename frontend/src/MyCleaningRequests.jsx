import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, AlertCircle, X } from "lucide-react";
import { useAuth } from "./AuthContext";
import Header from "./Header";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const STATUS_LABEL = {
  PENDING:     "Pending",
  CONFIRMED:   "Confirmed",
  IN_PROGRESS: "In Progress",
  COMPLETED:   "Completed",
  CANCELLED:   "Cancelled",
};

const STATUS_COLOR = {
  PENDING:     "bg-amber-50 text-amber-700",
  CONFIRMED:   "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  COMPLETED:   "bg-emerald-50 text-emerald-700",
  CANCELLED:   "bg-red-50 text-red-700",
};

export default function MyCleaningRequests() {
  const { token, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelError, setCancelError] = useState(null);

  // Redirect to /login if the user is not authenticated.
  // This runs before any fetch so request data is never exposed.
  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/login", { replace: true });
    }
  }, [isLoggedIn, navigate]);

  const fetchRequests = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/cleaning-requests/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((data) => setRequests(data.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleCancel = async (requestId) => {
    setCancellingId(requestId);
    setCancelError(null);
    try {
      const res = await fetch(`${API_URL}/api/cleaning-requests/${requestId}/cancel`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Cancellation failed.");
      // Update the request in local state
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: "CANCELLED" } : r))
      );
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <Header />
      <div className="max-w-2xl mx-auto px-5 pt-8 pb-24">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-1">
              My Cleaning Requests
            </h1>
            <p className="text-sm text-stone-400">Track your cleaning service bookings</p>
          </div>
          <Link
            to="/cleaning"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 px-4 h-9 rounded-full"
          >
            + New booking
          </Link>
        </div>

        {cancelError && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 mb-4">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{cancelError}</span>
            <button onClick={() => setCancelError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-stone-100 p-6 animate-pulse">
                <div className="h-4 bg-stone-100 rounded w-1/2 mb-2" />
                <div className="h-3 bg-stone-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-200">
            <Sparkles className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 text-sm mb-4">
              You haven't booked any cleaning services yet.
            </p>
            <Link
              to="/cleaning"
              className="inline-block bg-emerald-900 text-white text-sm font-medium px-5 h-10 leading-10 rounded-full hover:bg-emerald-800"
            >
              Browse services
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div key={req.id} className="bg-white rounded-2xl border border-stone-200 p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-medium text-stone-900 text-sm">
                      {req.service_name || "Cleaning Service"}
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      #{req.id.slice(0, 8)} ·{" "}
                      {new Date(req.created_at).toLocaleDateString("en-RW", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      STATUS_COLOR[req.status] || "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {STATUS_LABEL[req.status] || req.status}
                  </span>
                </div>

                <div className="text-xs text-stone-500 space-y-1 mb-4">
                  {req.location && (
                    <p>
                      <span className="text-stone-400">Location: </span>
                      {req.location}
                    </p>
                  )}
                  {req.preferred_date && (
                    <p>
                      <span className="text-stone-400">Date: </span>
                      {req.preferred_date}{" "}
                      {req.preferred_time ? `at ${req.preferred_time.slice(0, 5)}` : ""}
                    </p>
                  )}
                  {req.cleaner_name && (
                    <p>
                      <span className="text-stone-400">Cleaner: </span>
                      {req.cleaner_name}
                    </p>
                  )}
                  {req.price !== null && (
                    <p>
                      <span className="text-stone-400">Price: </span>
                      <span className="font-semibold text-emerald-800">
                        {Number(req.price).toLocaleString()} RWF
                      </span>
                    </p>
                  )}
                  {req.notes && (
                    <p>
                      <span className="text-stone-400">Notes: </span>
                      {req.notes}
                    </p>
                  )}
                </div>

                {/* Cancel button — only for PENDING requests */}
                {req.status === "PENDING" && (
                  <button
                    onClick={() => handleCancel(req.id)}
                    disabled={cancellingId === req.id}
                    className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                  >
                    {cancellingId === req.id ? "Cancelling..." : "Cancel request"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
