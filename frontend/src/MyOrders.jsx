import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Package } from "lucide-react";
import { useAuth } from "./AuthContext";
import Header from "./Header";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const STATUS_LABEL = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};
const STATUS_COLOR = {
  PENDING: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-blue-50 text-blue-700",
  PROCESSING: "bg-blue-50 text-blue-700",
  OUT_FOR_DELIVERY: "bg-blue-50 text-blue-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-red-50 text-red-700",
};

export default function MyOrders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((data) => setOrders(data.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <Header />
      <div className="max-w-2xl mx-auto px-5 pt-8 pb-24">
        <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-1">My orders</h1>
        <p className="text-sm text-stone-400 mb-6">Everything you've ordered from AmiServices</p>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 mb-4">{error}</div>
        )}

        {loading ? (
          <p className="text-sm text-stone-400 text-center py-16">Loading your orders...</p>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-200">
            <Package className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 text-sm mb-4">You haven't placed any orders yet</p>
            <Link
              to="/products"
              className="inline-block bg-emerald-900 text-white text-sm font-medium px-5 h-10 leading-10 rounded-full hover:bg-emerald-800"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl border border-stone-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-stone-900">Order #{order.id.slice(0, 8)}</p>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLOR[order.status] || "bg-stone-100 text-stone-600"}`}>
                    {STATUS_LABEL[order.status] || order.status}
                  </span>
                </div>
                <p className="text-sm text-stone-500 mb-1">
                  {order.items?.length || 0} item{order.items?.length === 1 ? "" : "s"} ·{" "}
                  {Number(order.total_amount).toLocaleString()} RWF
                </p>
                <p className="text-xs text-stone-400">
                  {order.fulfillment_type === "DELIVERY" ? "Delivery" : "Shop pickup"} ·{" "}
                  {new Date(order.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
