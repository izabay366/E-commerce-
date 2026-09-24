import React, { useState, useEffect, useCallback } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { useAuth } from "./AuthContext";
import { STATUS_FLOW, STATUS_LABEL, STATUS_COLOR } from "./orderStatus";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function AdminOrders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = filter !== "all" ? `?status=${filter}` : "";
    fetch(`${API_URL}/api/orders${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((data) => setOrders(data.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token, filter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const advanceStatus = async (order) => {
    const currentIndex = STATUS_FLOW.indexOf(order.status);
    const nextStatus = STATUS_FLOW[currentIndex + 1];
    if (!nextStatus) return;

    setUpdatingId(order.id);
    try {
      const res = await fetch(`${API_URL}/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Failed to update status (${res.status})`);
      }
      fetchOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteOrder = async (order) => {
    if (!window.confirm(`Delete order #${order.id.slice(0, 8)}? This can't be undone.`)) return;

    setDeletingId(order.id);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/orders/${order.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Delete failed (${res.status})`);
      }
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/orders`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirm: "DELETE_ALL_ORDERS" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Delete failed (${res.status})`);
      }
      setDeleteAllOpen(false);
      fetchOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <div className="max-w-5xl mx-auto px-5 pt-8 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-2xl font-semibold text-stone-900">Orders</h1>
          {orders.length > 0 && (
            <button
              onClick={() => setDeleteAllOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-full px-3 h-8 hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete all orders
            </button>
          )}
        </div>

        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {["all", ...STATUS_FLOW, "CANCELLED"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`shrink-0 text-sm px-3 h-8 rounded-full border ${
                filter === s ? "bg-emerald-900 text-white border-emerald-900" : "border-stone-200 text-stone-500"
              }`}
            >
              {s === "all" ? "All" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 mb-4">{error}</div>
        )}

        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="grid grid-cols-[1fr_1.5fr_1fr_1fr_1fr_auto] px-4 py-3 bg-stone-50 text-xs text-stone-400 font-medium">
            <span>Order</span>
            <span>Customer</span>
            <span>Total</span>
            <span>Status</span>
            <span></span>
            <span></span>
          </div>

          {loading ? (
            <p className="text-sm text-stone-400 text-center py-10">Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-10">No orders in this view.</p>
          ) : (
            orders.map((order) => {
              const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1];
              return (
                <div
                  key={order.id}
                  className="grid grid-cols-[1fr_1.5fr_1fr_1fr_1fr_auto] px-4 py-3 border-t border-stone-100 items-center text-sm"
                >
                  <span className="text-stone-500">#{order.id.slice(0, 8)}</span>
                  <span className="text-stone-900 truncate">
                    {order.guest_name || order.customer_name || "Registered customer"}
                  </span>
                  <span className="font-medium text-stone-900">
                    {Number(order.total_amount).toLocaleString()} RWF
                  </span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full w-fit ${STATUS_COLOR[order.status]}`}>
                    {STATUS_LABEL[order.status]}
                  </span>
                  <div className="text-right">
                    {order.status !== "DELIVERED" && order.status !== "CANCELLED" && nextStatus && (
                      <button
                        onClick={() => advanceStatus(order)}
                        disabled={updatingId === order.id}
                        className="text-xs font-medium text-emerald-800 border border-emerald-200 rounded-full px-3 h-7 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {updatingId === order.id ? "..." : `Mark ${STATUS_LABEL[nextStatus]}`}
                      </button>
                    )}
                  </div>
                  <div className="text-right">
                    <button
                      onClick={() => handleDeleteOrder(order)}
                      disabled={deletingId === order.id}
                      className="text-stone-400 hover:text-red-500 disabled:opacity-50"
                      title={`Delete order #${order.id.slice(0, 8)}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Delete-all confirmation modal — single confirm click */}
      {deleteAllOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-5 z-20">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h2 className="font-serif text-lg font-semibold text-stone-900">Delete ALL orders?</h2>
            </div>
            <p className="text-sm text-stone-500 mb-6">
              This permanently deletes every order in the system — {orders.length} order
              {orders.length === 1 ? "" : "s"} — along with their items, payments, and delivery
              records. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteAllOpen(false)}
                className="flex-1 h-10 rounded-full border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className="flex-1 h-10 rounded-full bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deletingAll ? "Deleting..." : "Delete everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
