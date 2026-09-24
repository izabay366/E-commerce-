/**
 * AdminPayments.jsx
 * Admin page for reviewing and managing payments.
 *
 * Route: /admin/payments (nested inside ProtectedAdminRoute + AdminLayout)
 *
 * Features:
 *   - Lists all payments via GET /api/payments (ADMIN only)
 *   - Filters by payment status and method
 *   - Payment review modal with customer info, order details, items
 *   - Confirm payment (PATCH /api/payments/:id) — PAID + CONFIRMED order
 *   - MoMo reference field for MOBILE_MONEY payments
 *   - Mark FAILED / CANCELLED for PENDING payments
 *   - Customer phone displayed as tel: link for quick calling
 *   - Loading, error, and empty states
 */

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "CANCELLED", "REFUNDED"];
const PAYMENT_METHODS  = ["CASH_ON_DELIVERY", "MOBILE_MONEY"];

const PAYMENT_STATUS_BADGE = {
  PENDING:   "bg-amber-50 text-amber-700 border border-amber-200",
  PAID:      "bg-emerald-50 text-emerald-700 border border-emerald-200",
  FAILED:    "bg-red-50 text-red-700 border border-red-200",
  CANCELLED: "bg-stone-100 text-stone-500 border border-stone-200",
  REFUNDED:  "bg-purple-50 text-purple-700 border border-purple-200",
};

const ORDER_STATUS_BADGE = {
  PENDING:          "bg-amber-50 text-amber-700",
  CONFIRMED:        "bg-blue-50 text-blue-700",
  PROCESSING:       "bg-blue-50 text-blue-700",
  OUT_FOR_DELIVERY: "bg-indigo-50 text-indigo-700",
  DELIVERED:        "bg-emerald-50 text-emerald-700",
  CANCELLED:        "bg-red-50 text-red-700",
};

const METHOD_LABEL = {
  CASH_ON_DELIVERY: "Cash on Delivery",
  MOBILE_MONEY:     "Mobile Money",
};

// ─── HELPER ───────────────────────────────────────────────────────────────────

function fmtAmount(n) {
  return Number(n).toLocaleString("fr-RW") + " RWF";
}

function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────

function PaymentBadge({ status }) {
  const cls = PAYMENT_STATUS_BADGE[status] || "bg-stone-100 text-stone-500";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {status}
    </span>
  );
}

function OrderBadge({ status }) {
  if (!status) return <span className="text-stone-400 text-xs">—</span>;
  const cls = ORDER_STATUS_BADGE[status] || "bg-stone-100 text-stone-500";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── PAYMENT REVIEW MODAL ─────────────────────────────────────────────────────

function PaymentModal({ payment, onClose, onUpdated, token }) {
  const [orderDetail, setOrderDetail]   = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [orderError, setOrderError]     = useState(null);
  const [momoRef, setMomoRef]           = useState(payment.momo_reference || "");
  const [submitting, setSubmitting]     = useState(false);
  const [actionError, setActionError]   = useState(null);

  // Fetch full order (including items) via existing GET /api/orders/:id
  useEffect(() => {
    setLoadingOrder(true);
    fetch(`${API_URL}/api/orders/${payment.order_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load order (${r.status})`);
        return r.json();
      })
      .then((data) => setOrderDetail(data.order || null))
      .catch((e) => setOrderError(e.message))
      .finally(() => setLoadingOrder(false));
  }, [payment.order_id, token]);

  // ── PATCH /api/payments/:id ───────────────────────────────────────────────
  const patchPayment = useCallback(async (body) => {
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_URL}/api/payments/${payment.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || `Update failed (${res.status})`);
      }
      onUpdated();
      onClose();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setSubmitting(false);
    }
  }, [payment.id, token, onUpdated, onClose]);

  const handleConfirmPaid = () => {
    const body = {
      status:       "PAID",
      order_status: "CONFIRMED",
    };
    if (payment.method === "MOBILE_MONEY" && momoRef.trim()) {
      body.momo_reference = momoRef.trim();
    }
    patchPayment(body);
  };

  const handleMarkFailed    = () => patchPayment({ status: "FAILED",    order_status: "CANCELLED" });
  const handleMarkCancelled = () => patchPayment({ status: "CANCELLED", order_status: "CANCELLED" });

  const isPending  = payment.status === "PENDING";
  const isTerminal = ["CANCELLED", "FAILED"].includes(payment.status);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="font-serif text-lg font-semibold text-stone-900">Payment Review</h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 text-xl font-bold leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">

          {/* ── Customer ────────────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
              Customer
            </h3>
            <div className="bg-stone-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-stone-500">Name</span>
                <span className="text-sm font-medium text-stone-900">
                  {payment.customer?.name || "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-stone-500">Phone</span>
                <a
                  href={`tel:${payment.customer?.phone}`}
                  className="text-sm font-semibold text-emerald-700 hover:underline"
                >
                  📞 {payment.customer?.phone || "—"}
                </a>
              </div>
              {payment.customer?.email && (
                <div className="flex justify-between">
                  <span className="text-sm text-stone-500">Email</span>
                  <span className="text-sm text-stone-700">{payment.customer.email}</span>
                </div>
              )}
            </div>
          </section>

          {/* ── Order ───────────────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
              Order
            </h3>
            <div className="bg-stone-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-stone-500">Order ID</span>
                <span className="text-sm font-mono text-stone-700">#{payment.order_id?.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-stone-500">Order Status</span>
                <OrderBadge status={payment.order_status} />
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-stone-500">Fulfillment</span>
                <span className="text-sm font-medium text-stone-900 capitalize">
                  {(payment.fulfillment_type || "—").replace(/_/g, " ").toLowerCase()}
                </span>
              </div>
              {orderDetail?.delivery?.address && (
                <div className="flex justify-between">
                  <span className="text-sm text-stone-500">Delivery Address</span>
                  <span className="text-sm text-stone-700 text-right max-w-[60%]">
                    {orderDetail.delivery.address}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* ── Payment ─────────────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
              Payment
            </h3>
            <div className="bg-stone-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-stone-500">Payment ID</span>
                <span className="text-sm font-mono text-stone-700">#{payment.id?.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-stone-500">Amount</span>
                <span className="text-sm font-bold text-stone-900">{fmtAmount(payment.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-stone-500">Method</span>
                <span className="text-sm font-medium text-stone-900">
                  {METHOD_LABEL[payment.method] || payment.method}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-stone-500">Status</span>
                <PaymentBadge status={payment.status} />
              </div>
              {payment.momo_reference && (
                <div className="flex justify-between">
                  <span className="text-sm text-stone-500">MoMo Reference</span>
                  <span className="text-sm font-mono text-stone-700">{payment.momo_reference}</span>
                </div>
              )}
              {payment.transaction_reference && (
                <div className="flex justify-between">
                  <span className="text-sm text-stone-500">Transaction Ref</span>
                  <span className="text-sm font-mono text-stone-700">{payment.transaction_reference}</span>
                </div>
              )}
            </div>
          </section>

          {/* ── Order Items ──────────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
              Order Items
            </h3>
            {loadingOrder ? (
              <p className="text-sm text-stone-400 text-center py-4">Loading items…</p>
            ) : orderError ? (
              <p className="text-sm text-red-500 text-center py-4">{orderError}</p>
            ) : (orderDetail?.items || []).length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-4">No items found.</p>
            ) : (
              <div className="border border-stone-200 rounded-xl overflow-hidden">
                {(orderDetail.items || []).map((item, i) => (
                  <div
                    key={item.id || i}
                    className={`flex items-center justify-between px-4 py-3 text-sm ${
                      i > 0 ? "border-t border-stone-100" : ""
                    }`}
                  >
                    <div>
                      <p className="font-medium text-stone-900">{item.product_name}</p>
                      {item.variant_name && (
                        <p className="text-stone-400 text-xs mt-0.5">{item.variant_name}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-stone-700">× {item.quantity}</p>
                      <p className="text-stone-500 text-xs">{fmtAmount(item.subtotal)}</p>
                    </div>
                  </div>
                ))}
                <div className="bg-stone-50 px-4 py-3 flex justify-between border-t border-stone-200">
                  <span className="text-sm font-semibold text-stone-700">Total</span>
                  <span className="text-sm font-bold text-stone-900">{fmtAmount(payment.amount)}</span>
                </div>
              </div>
            )}
          </section>

          {/* ── MoMo Reference Input (MOBILE_MONEY only) ────────────────── */}
          {isPending && payment.method === "MOBILE_MONEY" && (
            <section>
              <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
                MoMo Reference
              </h3>
              <input
                id="momo-reference-input"
                type="text"
                value={momoRef}
                onChange={(e) => setMomoRef(e.target.value)}
                placeholder="Enter MoMo transaction reference…"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-xs text-stone-400 mt-1.5">
                Call the customer at{" "}
                <a
                  href={`tel:${payment.customer?.phone}`}
                  className="text-emerald-700 font-semibold hover:underline"
                >
                  {payment.customer?.phone}
                </a>{" "}
                to verify the MoMo transaction before confirming.
              </p>
            </section>
          )}

          {/* ── COD Note ────────────────────────────────────────────────── */}
          {isPending && payment.method === "CASH_ON_DELIVERY" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">💰 Cash on Delivery</p>
              <p>
                Call the customer at{" "}
                <a
                  href={`tel:${payment.customer?.phone}`}
                  className="font-bold text-amber-900 hover:underline"
                >
                  {payment.customer?.phone}
                </a>{" "}
                to confirm the order. Mark as PAID only after cash is collected at delivery.
              </p>
            </div>
          )}

          {/* ── Terminal state notice ────────────────────────────────────── */}
          {isTerminal && (
            <div className="bg-stone-100 border border-stone-200 rounded-xl p-4 text-sm text-stone-600 text-center">
              This payment is <strong>{payment.status}</strong> — no further changes allowed.
            </div>
          )}

          {/* ── Action Error ─────────────────────────────────────────────── */}
          {actionError && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-3">
              {actionError}
            </div>
          )}

          {/* ── Action Buttons (PENDING only) ────────────────────────────── */}
          {isPending && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                id="btn-confirm-paid"
                onClick={handleConfirmPaid}
                disabled={submitting}
                className="flex-1 min-w-[140px] bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors"
              >
                {submitting ? "Saving…" : "✓ Mark PAID + Confirm Order"}
              </button>
              <button
                id="btn-mark-failed"
                onClick={handleMarkFailed}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                Mark Failed
              </button>
              <button
                id="btn-mark-cancelled"
                onClick={handleMarkCancelled}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-colors"
              >
                Mark Cancelled
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function AdminPayments() {
  const { token } = useAuth();

  const [payments, setPayments]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [selected, setSelected]     = useState(null); // payment for modal

  // ── Fetch payments ─────────────────────────────────────────────────────────
  const fetchPayments = useCallback(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (methodFilter !== "ALL") params.set("method", methodFilter);
    const qs = params.toString() ? `?${params.toString()}` : "";

    fetch(`${API_URL}/api/payments${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load payments (${r.status})`);
        return r.json();
      })
      .then((data) => setPayments(data.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, statusFilter, methodFilter]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const handleUpdated = () => { fetchPayments(); };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <div className="max-w-6xl mx-auto px-5 pt-8 pb-16">

        {/* Page title + refresh */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-2xl font-semibold text-stone-900">Payments</h1>
          <button
            onClick={fetchPayments}
            className="text-sm text-stone-500 hover:text-stone-900 border border-stone-200 rounded-lg px-3 py-1.5 hover:bg-white transition-colors"
          >
            ↻ Refresh
          </button>
        </div>

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 mb-5">
          {/* Status filter */}
          <div className="flex gap-1.5 flex-wrap">
            {["ALL", ...PAYMENT_STATUSES].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs font-medium px-3 h-7 rounded-full border transition-colors ${
                  statusFilter === s
                    ? "bg-emerald-900 text-white border-emerald-900"
                    : "border-stone-200 text-stone-500 hover:border-stone-300"
                }`}
              >
                {s === "ALL" ? "All Statuses" : s}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px bg-stone-200 self-stretch hidden sm:block" />

          {/* Method filter */}
          <div className="flex gap-1.5">
            {["ALL", ...PAYMENT_METHODS].map((m) => (
              <button
                key={m}
                onClick={() => setMethodFilter(m)}
                className={`text-xs font-medium px-3 h-7 rounded-full border transition-colors ${
                  methodFilter === m
                    ? "bg-stone-800 text-white border-stone-800"
                    : "border-stone-200 text-stone-500 hover:border-stone-300"
                }`}
              >
                {m === "ALL" ? "All Methods" : METHOD_LABEL[m] || m}
              </button>
            ))}
          </div>
        </div>

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 mb-5">
            {error}
            <button onClick={fetchPayments} className="ml-3 underline">Retry</button>
          </div>
        )}

        {/* ── Table ────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">

          {/* Table header */}
          <div className="hidden md:grid grid-cols-[1fr_1.4fr_1fr_1fr_1fr_1fr_1fr_auto] px-4 py-3 bg-stone-50 text-xs text-stone-400 font-semibold uppercase tracking-wide border-b border-stone-100">
            <span>Order</span>
            <span>Customer</span>
            <span>Phone</span>
            <span>Amount</span>
            <span>Method</span>
            <span>Payment</span>
            <span>Order</span>
            <span></span>
          </div>

          {loading ? (
            <p className="text-sm text-stone-400 text-center py-14">Loading payments…</p>
          ) : payments.length === 0 ? (
            <div className="text-center py-14">
              <p className="text-stone-400 text-sm">No payments found.</p>
              {(statusFilter !== "ALL" || methodFilter !== "ALL") && (
                <button
                  onClick={() => { setStatusFilter("ALL"); setMethodFilter("ALL"); }}
                  className="mt-2 text-xs text-emerald-700 underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            payments.map((p) => (
              <div
                key={p.id}
                className="grid md:grid-cols-[1fr_1.4fr_1fr_1fr_1fr_1fr_1fr_auto] grid-cols-2 px-4 py-3.5 border-t border-stone-100 items-center text-sm gap-y-1"
              >
                {/* Order ID */}
                <span className="font-mono text-stone-500 text-xs">
                  #{p.order_id?.slice(0, 8)}
                </span>

                {/* Customer name */}
                <span className="text-stone-900 truncate font-medium">
                  {p.customer?.name || "—"}
                </span>

                {/* Phone */}
                <a
                  href={`tel:${p.customer?.phone}`}
                  className="text-emerald-700 hover:underline text-xs font-medium"
                >
                  {p.customer?.phone || "—"}
                </a>

                {/* Amount */}
                <span className="font-semibold text-stone-900 text-xs">
                  {fmtAmount(p.amount)}
                </span>

                {/* Method */}
                <span className="text-stone-600 text-xs">
                  {METHOD_LABEL[p.method] || p.method}
                </span>

                {/* Payment status badge */}
                <span>
                  <PaymentBadge status={p.status} />
                </span>

                {/* Order status badge */}
                <span>
                  <OrderBadge status={p.order_status} />
                </span>

                {/* Action */}
                <div className="text-right md:text-right col-span-2 md:col-span-1">
                  <button
                    id={`btn-review-${p.id}`}
                    onClick={() => setSelected(p)}
                    className="text-xs font-medium text-emerald-800 border border-emerald-200 rounded-full px-3 h-7 hover:bg-emerald-50 transition-colors"
                  >
                    Review
                  </button>
                </div>

                {/* Date row (mobile/desktop) */}
                <span className="col-span-2 md:hidden text-xs text-stone-400">
                  {fmtDate(p.created_at)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Payment count */}
        {!loading && payments.length > 0 && (
          <p className="text-xs text-stone-400 mt-3 text-right">
            {payments.length} payment{payments.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {selected && (
        <PaymentModal
          payment={selected}
          token={token}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
