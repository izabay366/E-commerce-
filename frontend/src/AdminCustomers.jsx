import React, { useState, useEffect, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { useAuth } from "./AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function formatDate(dateString) {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function AdminCustomers() {
  const { token, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((body) => setUsers(body.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDelete = async (u) => {
    const displayName = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "this account";
    if (!window.confirm(`Permanently delete ${displayName}? This can't be undone.`)) return;

    setDeletingId(u.id);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/users/${u.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Delete failed (${res.status})`);
      }
      setUsers((prev) => prev.filter((existing) => existing.id !== u.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    const name = `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase();
    return (
      name.includes(term) ||
      (u.email || "").toLowerCase().includes(term) ||
      (u.phone || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="max-w-5xl mx-auto px-5 pt-8 pb-16">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-stone-900">Customers</h1>
        <p className="text-sm text-stone-400 mt-1">
          Everyone who has created an account — {users.length} total.
        </p>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, email, or phone..."
        className="w-full h-10 px-3 rounded-lg border border-stone-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-800/30"
      />

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 mb-4">{error}</div>
      )}

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_auto_1fr_auto] px-4 py-3 bg-stone-50 text-xs text-stone-400 font-medium">
          <span>Name</span>
          <span>Phone</span>
          <span>Email</span>
          <span>Role</span>
          <span>Joined</span>
          <span></span>
        </div>

        {loading ? (
          <p className="text-sm text-stone-400 text-center py-10">Loading customers...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-10">
            {search ? `No customers match "${search}".` : "No customers yet."}
          </p>
        ) : (
          filtered.map((u) => (
            <div
              key={u.id}
              className="grid grid-cols-[1.5fr_1fr_1fr_auto_1fr_auto] px-4 py-3 border-t border-stone-100 items-center text-sm"
            >
              <span className="text-stone-900 truncate">
                {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
              </span>
              <span className="text-stone-500 truncate">{u.phone || "—"}</span>
              <span className="text-stone-500 truncate">{u.email || "—"}</span>
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full w-fit ${
                  u.role?.toLowerCase() === "admin"
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-stone-100 text-stone-500"
                }`}
              >
                {u.role || "—"}
              </span>
              <span className="text-stone-400 text-xs">{formatDate(u.created_at)}</span>
              <div className="flex justify-end">
                {u.id === user?.userId ? (
                  <span className="text-xs text-stone-300">You</span>
                ) : (
                  <button
                    onClick={() => handleDelete(u)}
                    disabled={deletingId === u.id}
                    className="text-stone-400 hover:text-red-500 disabled:opacity-50"
                    title={`Delete ${u.email || "account"}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
