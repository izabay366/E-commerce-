import React, { useState, useEffect, useCallback } from "react";
import { Search, ChevronDown, X, AlertCircle, User } from "lucide-react";
import { useAuth } from "./AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const VALID_STATUSES = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const STATUS_FLOW    = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"];

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

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-RW", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminCleaningRequests() {
  const { token } = useAuth();
  const [requests, setRequests] = useState([]);
  const [cleaners, setCleaners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const authHeader = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const fetchRequests = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = filter !== "all" ? `?status=${filter}` : "";
    fetch(`${API_URL}/api/cleaning-requests${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setRequests(d.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, filter]);

  const fetchCleaners = useCallback(() => {
    fetch(`${API_URL}/api/cleaners`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setCleaners(d.data || []))
      .catch(() => {});
  }, [token]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);
  useEffect(() => { fetchCleaners(); }, [fetchCleaners]);

  const handleStatusChange = async (requestId, newStatus) => {
    setUpdatingId(requestId);
    setActionError(null);
    try {
      const res = await fetch(`${API_URL}/api/cleaning-requests/${requestId}`, {
        method: "PATCH",
        headers: authHeader,
        body: JSON.stringify({ status: newStatus }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message || "Failed to update status.");
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: newStatus } : r))
      );
    } catch (e) {
      setActionError(e.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAssignCleaner = async (requestId, cleanerId) => {
    setUpdatingId(requestId);
    setActionError(null);
    try {
      const res = await fetch(`${API_URL}/api/cleaning-requests/${requestId}`, {
        method: "PATCH",
        headers: authHeader,
        body: JSON.stringify({ cleaner_id: cleanerId || null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message || "Failed to assign cleaner.");
      fetchRequests();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = requests.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.customer_name?.toLowerCase().includes(term) ||
      r.customer_phone?.toLowerCase().includes(term) ||
      r.service_name?.toLowerCase().includes(term) ||
      r.location?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-stone-900">Cleaning Requests</h1>
        <p className="text-sm text-stone-400 mt-0.5">Manage and track all cleaning bookings</p>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 border border-red-100 rounded-xl p-4 mb-4 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {/* Status filter */}
        <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-lg p-1">
          {["all", ...VALID_STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-xs font-medium px-3 h-7 rounded-md transition-colors ${
                filter === s
                  ? "bg-emerald-900 text-white"
                  : "text-stone-500 hover:text-stone-900 hover:bg-stone-50"
              }`}
            >
              {s === "all" ? "All" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, phone, service..."
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-stone-200 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 bg-white"
          />
        </div>

        <span className="text-xs text-stone-400 ml-auto">
          {filtered.length} request{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-stone-100 h-20 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-stone-200">
          <p className="text-stone-400 text-sm">No requests found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((req) => {
            const isExpanded = expandedId === req.id;
            const isUpdating = updatingId === req.id;
            const currentIdx = STATUS_FLOW.indexOf(req.status);
            const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1
              ? STATUS_FLOW[currentIdx + 1]
              : null;

            return (
              <div key={req.id} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                {/* Row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-stone-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-stone-900 truncate">
                        {req.customer_name || "—"}
                      </p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[req.status] || "bg-stone-100 text-stone-500"}`}>
                        {STATUS_LABEL[req.status] || req.status}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 truncate">
                      {req.service_name || "Unknown service"} · {req.customer_phone || "—"} · {formatDate(req.created_at)}
                    </p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-stone-400 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-stone-100 px-5 py-4 bg-stone-50">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-stone-600 mb-4">
                      <p><span className="text-stone-400">Service: </span>{req.service_name || "—"}</p>
                      <p><span className="text-stone-400">Phone: </span>{req.customer_phone || "—"}</p>
                      <p><span className="text-stone-400">Location: </span>{req.location || "—"}</p>
                      {req.preferred_date && (
                        <p>
                          <span className="text-stone-400">Date: </span>
                          {req.preferred_date}
                          {req.preferred_time ? ` at ${req.preferred_time.slice(0, 5)}` : ""}
                        </p>
                      )}
                      {req.price !== null && (
                        <p>
                          <span className="text-stone-400">Price: </span>
                          <span className="text-emerald-700 font-semibold">
                            {Number(req.price).toLocaleString()} RWF
                          </span>
                        </p>
                      )}
                      {req.cleaner_name && (
                        <p><span className="text-stone-400">Cleaner: </span>{req.cleaner_name}</p>
                      )}
                      {req.notes && (
                        <p className="col-span-2"><span className="text-stone-400">Notes: </span>{req.notes}</p>
                      )}
                    </div>

                    {/* Admin actions */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Assign cleaner */}
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-stone-400" />
                        <select
                          value={req.cleaner_id || ""}
                          onChange={(e) => handleAssignCleaner(req.id, e.target.value || null)}
                          disabled={isUpdating}
                          className="text-xs h-8 px-2 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-800/20 disabled:opacity-50"
                        >
                          <option value="">Assign cleaner...</option>
                          {cleaners.filter((c) => c.is_active).map((c) => (
                            <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
                          ))}
                        </select>
                      </div>

                      {/* Advance status */}
                      {nextStatus && req.status !== "CANCELLED" && (
                        <button
                          onClick={() => handleStatusChange(req.id, nextStatus)}
                          disabled={isUpdating}
                          className="text-xs font-medium bg-emerald-900 text-white px-3 h-8 rounded-lg hover:bg-emerald-800 disabled:opacity-50"
                        >
                          {isUpdating ? "Updating..." : `→ ${STATUS_LABEL[nextStatus]}`}
                        </button>
                      )}

                      {/* Cancel */}
                      {req.status !== "CANCELLED" && req.status !== "COMPLETED" && (
                        <button
                          onClick={() => handleStatusChange(req.id, "CANCELLED")}
                          disabled={isUpdating}
                          className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                        >
                          Cancel request
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
