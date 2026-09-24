import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Search, Package } from "lucide-react";
import { useAuth } from "./AuthContext";
import Header from "./Header";
import { STATUS_FLOW, STATUS_LABEL, STATUS_COLOR } from "./orderStatus";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function TrackOrder() {
  const { isLoggedIn, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    if (!orderId.trim()) {
      setError("Enter an order ID.");
      return;
    }

    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId.trim()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.message || `Couldn't find that order (${res.status})`);
      }
      setOrder(body.order);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentStepIndex = order ? STATUS_FLOW.indexOf(order.status) : -1;
  const isCancelled = order?.status === "CANCELLED";

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <Header />
      <div className="max-w-xl mx-auto px-5 pt-8 pb-24">
        <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-1">Track an order</h1>
        <p className="text-sm text-stone-400 mb-6">
          Enter the order ID from your confirmation to see its current status.
        </p>

        {!isLoggedIn && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl p-3 mb-5">
            Order tracking needs you to be signed in — guest orders currently can't be looked up this
            way. Search below and you'll be sent to sign in first.
          </div>
        )}

        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="Order ID"
            className="flex-1 h-11 px-4 rounded-full border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/30"
          />
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 bg-emerald-900 text-white text-sm font-medium px-5 h-11 rounded-full hover:bg-emerald-800 disabled:opacity-50 shrink-0"
          >
            <Search className="w-4 h-4" /> {loading ? "Searching..." : "Track"}
          </button>
        </form>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 mb-5">{error}</div>
        )}

        {order && (
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-stone-400">Order</p>
                <p className="text-sm font-medium text-stone-900">#{String(order.id).slice(0, 8)}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLOR[order.status] || "bg-stone-100 text-stone-500"}`}>
                {STATUS_LABEL[order.status] || order.status}
              </span>
            </div>

            {isCancelled ? (
              <p className="text-sm text-stone-500">This order was cancelled.</p>
            ) : (
              <div className="space-y-3">
                {STATUS_FLOW.map((status, i) => (
                  <div key={status} className="flex items-center gap-3">
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        i <= currentStepIndex ? "bg-emerald-800" : "bg-stone-200"
                      }`}
                    />
                    <span className={`text-sm ${i <= currentStepIndex ? "text-stone-900 font-medium" : "text-stone-400"}`}>
                      {STATUS_LABEL[status]}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {order.total_amount != null && (
              <div className="border-t border-stone-100 mt-4 pt-4 flex justify-between text-sm">
                <span className="text-stone-500">Total</span>
                <span className="font-semibold text-stone-900">
                  {Number(order.total_amount).toLocaleString()} RWF
                </span>
              </div>
            )}
          </div>
        )}

        {!order && !error && !loading && (
          <div className="text-center py-16 text-stone-300">
            <Package className="w-10 h-10 mx-auto mb-2" />
            <p className="text-sm text-stone-400">Search for an order to see its status here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
