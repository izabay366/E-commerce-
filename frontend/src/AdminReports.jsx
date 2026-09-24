import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { STATUS_LABEL } from "./orderStatus";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5">
      <p className="text-2xl font-semibold text-stone-900">{value}</p>
      <p className="text-xs text-stone-400 mt-1">{label}</p>
    </div>
  );
}

export default function AdminReports() {
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
      .then((body) => setOrders(body.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  // Cancelled orders don't count as real revenue.
  const completedOrders = orders.filter((o) => o.status !== "CANCELLED");
  const totalRevenue = completedOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const averageOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

  const statusBreakdown = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const deliveryCount = orders.filter((o) => o.fulfillment_type === "DELIVERY").length;
  const pickupCount = orders.filter((o) => o.fulfillment_type === "PICKUP").length;

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10);

  return (
    <div className="max-w-5xl mx-auto px-5 pt-8 pb-16">
      <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-1">Reports</h1>
      <p className="text-sm text-stone-400 mb-6">A snapshot built from every order placed so far.</p>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 mb-5">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-stone-400 text-center py-16">Loading report data...</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-16">No orders yet — reports will fill in once orders start coming in.</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total orders" value={orders.length} />
            <StatCard label="Total revenue" value={`${Math.round(totalRevenue).toLocaleString()} RWF`} />
            <StatCard label="Avg. order value" value={`${Math.round(averageOrderValue).toLocaleString()} RWF`} />
            <StatCard label="Delivery / Pickup" value={`${deliveryCount} / ${pickupCount}`} />
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-6">
            <h2 className="text-sm font-semibold text-stone-900 mb-4">Orders by status</h2>
            <div className="space-y-2">
              {Object.entries(statusBreakdown).map(([status, count]) => (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-xs text-stone-500 w-32 shrink-0">{STATUS_LABEL[status] || status}</span>
                  <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-800"
                      style={{ width: `${(count / orders.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-stone-400 w-8 text-right shrink-0">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-3 bg-stone-50 border-b border-stone-100">
              <h2 className="text-sm font-semibold text-stone-900">Most recent orders</h2>
            </div>
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr] px-5 py-2 text-xs text-stone-400 font-medium">
              <span>Order</span>
              <span>Total</span>
              <span>Status</span>
              <span>Date</span>
            </div>
            {recentOrders.map((o) => (
              <div key={o.id} className="grid grid-cols-[1fr_1fr_1fr_1fr] px-5 py-3 border-t border-stone-100 text-sm">
                <span className="text-stone-500">#{String(o.id).slice(0, 8)}</span>
                <span className="text-stone-900 font-medium">{Number(o.total_amount || 0).toLocaleString()} RWF</span>
                <span className="text-stone-500">{STATUS_LABEL[o.status] || o.status}</span>
                <span className="text-stone-400 text-xs">{new Date(o.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
