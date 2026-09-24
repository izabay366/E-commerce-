import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Package, ListOrdered, AlertTriangle } from "lucide-react";
import { useAuth } from "./AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function StatCard({ icon: Icon, label, value, loading, to }) {
  const content = (
    <div className="bg-white rounded-2xl border border-stone-200 p-5 flex items-center gap-4 hover:border-emerald-200 transition-colors">
      <div className="w-11 h-11 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-emerald-800" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-stone-900">{loading ? "—" : value}</p>
        <p className="text-xs text-stone-400">{label}</p>
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export default function AdminDashboard() {
  const { token } = useAuth();
  const [productCount, setProductCount] = useState(0);
  const [pendingOrderCount, setPendingOrderCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`${API_URL}/api/products`).then((r) => r.json()),
      fetch(`${API_URL}/api/orders?status=pending`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : { data: [] })),
    ])
      .then(([products, pendingOrders]) => {
        const productList = products.data || [];
        setProductCount(productList.length);
        setLowStockCount(
          productList.filter((p) => Number(p.stock_qty) <= Number(p.low_stock_threshold ?? 5)).length
        );
        setPendingOrderCount((pendingOrders.data || []).length);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="max-w-5xl mx-auto px-5 pt-8 pb-16">
      <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-1">Dashboard</h1>
      <p className="text-sm text-stone-400 mb-6">A quick look at how the shop is doing right now.</p>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 mb-5">{error}</div>
      )}

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <StatCard icon={Package} label="Products" value={productCount} loading={loading} to="/admin/products" />
        <StatCard icon={ListOrdered} label="Pending orders" value={pendingOrderCount} loading={loading} to="/admin/orders" />
        <StatCard icon={AlertTriangle} label="Low stock" value={lowStockCount} loading={loading} to="/admin/products" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          to="/admin/products"
          className="bg-white rounded-2xl border border-stone-200 p-5 hover:border-emerald-200 transition-colors"
        >
          <p className="text-sm font-semibold text-stone-900 mb-1">Manage products</p>
          <p className="text-xs text-stone-400">Add, edit, or remove items and adjust stock levels.</p>
        </Link>
        <Link
          to="/admin/orders"
          className="bg-white rounded-2xl border border-stone-200 p-5 hover:border-emerald-200 transition-colors"
        >
          <p className="text-sm font-semibold text-stone-900 mb-1">Manage orders</p>
          <p className="text-xs text-stone-400">Review incoming orders and move them through fulfillment.</p>
        </Link>
      </div>
    </div>
  );
}
