import React, { useState, useEffect, useMemo } from "react";
import { Printer } from "lucide-react";
import { useAuth } from "./AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function startOfWeekAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function AdminReport() {
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

  const weekOrders = useMemo(() => {
    const cutoff = startOfWeekAgo();
    return orders.filter((o) => new Date(o.created_at) >= cutoff);
  }, [orders]);

  const stats = useMemo(() => {
    const paidOrders = weekOrders.filter((o) => o.payment?.status === "PAID");
    const totalSales = paidOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const totalOrders = weekOrders.length;

    const byStatus = {};
    weekOrders.forEach((o) => {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    });

    const byMethod = {};
    weekOrders.forEach((o) => {
      const m = o.payment?.method || "UNKNOWN";
      byMethod[m] = (byMethod[m] || 0) + 1;
    });

    const productCounts = {};
    weekOrders.forEach((o) => {
      o.items?.forEach((item) => {
        const key = item.product_name;
        productCounts[key] = (productCounts[key] || 0) + item.quantity;
      });
    });
    const topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { totalSales, totalOrders, byStatus, byMethod, topProducts };
  }, [weekOrders]);

  const today = new Date();
  const cutoff = startOfWeekAgo();
  const dateRangeLabel = `${cutoff.toLocaleDateString()} — ${today.toLocaleDateString()}`;

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <div className="max-w-3xl mx-auto px-5 pt-8 pb-16 print:px-0 print:pt-0">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-stone-900">Weekly report</h1>
            <p className="text-sm text-stone-400">{dateRangeLabel}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-emerald-900 text-white text-sm font-medium px-4 h-10 rounded-full hover:bg-emerald-800"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>

        {/* Print-only header, since the button/nav above is hidden when printing */}
        <div className="hidden print:block mb-6">
          <h1 className="text-xl font-bold">MuhangaShop — Weekly Report</h1>
          <p className="text-sm text-stone-500">{dateRangeLabel}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 mb-4">{error}</div>
        )}

        {loading ? (
          <p className="text-sm text-stone-400 text-center py-16">Loading report...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-6 print:grid-cols-2">
              <div className="bg-white rounded-2xl border border-stone-200 p-4 print:border-stone-300">
                <p className="text-xs text-stone-400 mb-1">Total sales (paid orders)</p>
                <p className="text-2xl font-semibold text-stone-900">{stats.totalSales.toLocaleString()} RWF</p>
              </div>
              <div className="bg-white rounded-2xl border border-stone-200 p-4 print:border-stone-300">
                <p className="text-xs text-stone-400 mb-1">Total orders</p>
                <p className="text-2xl font-semibold text-stone-900">{stats.totalOrders}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-4 print:border-stone-300 print:break-inside-avoid">
              <h2 className="text-sm font-semibold text-stone-900 mb-3">Orders by status</h2>
              <div className="space-y-1.5">
                {Object.entries(stats.byStatus).map(([status, count]) => (
                  <div key={status} className="flex justify-between text-sm">
                    <span className="text-stone-500">{status}</span>
                    <span className="font-medium text-stone-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-4 print:border-stone-300 print:break-inside-avoid">
              <h2 className="text-sm font-semibold text-stone-900 mb-3">Payment method</h2>
              <div className="space-y-1.5">
                {Object.entries(stats.byMethod).map(([method, count]) => (
                  <div key={method} className="flex justify-between text-sm">
                    <span className="text-stone-500">{method === "MOBILE_MONEY" ? "Mobile Money" : "Cash on delivery"}</span>
                    <span className="font-medium text-stone-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 p-5 print:border-stone-300 print:break-inside-avoid">
              <h2 className="text-sm font-semibold text-stone-900 mb-3">Top products this week</h2>
              {stats.topProducts.length === 0 ? (
                <p className="text-sm text-stone-400">No sales yet this week.</p>
              ) : (
                <div className="space-y-1.5">
                  {stats.topProducts.map(([name, qty]) => (
                    <div key={name} className="flex justify-between text-sm">
                      <span className="text-stone-500">{name}</span>
                      <span className="font-medium text-stone-900">{qty} sold</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
