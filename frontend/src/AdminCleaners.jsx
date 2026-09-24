import React, { useState, useEffect, useCallback } from "react";
import { Users, Plus, Pencil, Check, X, AlertCircle } from "lucide-react";
import { useAuth } from "./AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const VALID_STATUSES = ["AVAILABLE", "BUSY", "INACTIVE"];
const STATUS_COLOR = {
  AVAILABLE: "bg-emerald-50 text-emerald-700",
  BUSY:      "bg-amber-50 text-amber-700",
  INACTIVE:  "bg-stone-100 text-stone-500",
};

function CleanerForm({ initial, onSave, onCancel, saving }) {
  const [name, setName] = useState(initial?.name || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [status, setStatus] = useState(initial?.status || "AVAILABLE");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name, phone, address, status, is_active: isActive });
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Name *</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jean Baptiste"
            className="w-full h-9 px-3 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Phone *</label>
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+250788123456"
            className="w-full h-9 px-3 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/20"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Address</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Muhanga Town"
          className="w-full h-9 px-3 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/20"
        />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-stone-600 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/20 bg-white"
          >
            {VALID_STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
        {initial && (
          <label className="flex items-center gap-2 mt-5 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-stone-700">Active</span>
          </label>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 bg-emerald-900 text-white text-sm px-4 h-9 rounded-lg hover:bg-emerald-800 disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" />
          {saving ? "Saving..." : initial ? "Save" : "Add cleaner"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-stone-500 hover:text-stone-900 px-4 h-9 rounded-lg border border-stone-200 hover:bg-stone-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function AdminCleaners() {
  const { token } = useAuth();
  const [cleaners, setCleaners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState(null);

  const fetchCleaners = useCallback(() => {
    setLoading(true);
    fetch(`${API_URL}/api/cleaners`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setCleaners(d.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchCleaners(); }, [fetchCleaners]);

  const authHeader = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const handleCreate = async (data) => {
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_URL}/api/cleaners`, {
        method: "POST", headers: authHeader, body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.errors?.join(", ") || body?.message || "Failed.");
      setShowCreate(false);
      fetchCleaners();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id, data) => {
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_URL}/api/cleaners/${id}`, {
        method: "PATCH", headers: authHeader, body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message || "Failed.");
      setEditingId(null);
      fetchCleaners();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Cleaners</h1>
          <p className="text-sm text-stone-400 mt-0.5">Manage your cleaning team</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setEditingId(null); setActionError(null); }}
          className="flex items-center gap-1.5 bg-emerald-900 text-white text-sm px-4 h-9 rounded-lg hover:bg-emerald-800"
        >
          <Plus className="w-4 h-4" /> Add cleaner
        </button>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 border border-red-100 rounded-xl p-4 mb-4 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {showCreate && (
        <div className="bg-white rounded-2xl border border-emerald-100 p-5 mb-4">
          <h3 className="text-sm font-semibold text-stone-900 mb-4">New Cleaner</h3>
          <CleanerForm onSave={handleCreate} onCancel={() => setShowCreate(false)} saving={saving} />
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-stone-100 p-5 h-16 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      ) : cleaners.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-stone-200">
          <Users className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 text-sm">No cleaners yet. Add one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cleaners.map((c) => (
            <div key={c.id} className={`bg-white rounded-2xl border p-5 ${c.is_active ? "border-stone-200" : "border-stone-100 opacity-60"}`}>
              {editingId === c.id ? (
                <>
                  <h3 className="text-sm font-semibold text-stone-900 mb-4">Edit Cleaner</h3>
                  <CleanerForm
                    initial={c}
                    onSave={(data) => handleUpdate(c.id, data)}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                  />
                </>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-stone-900 text-sm">{c.name}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[c.status] || "bg-stone-100 text-stone-500"}`}>
                        {c.status}
                      </span>
                      {!c.is_active && (
                        <span className="text-[10px] font-medium bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">Inactive</span>
                      )}
                    </div>
                    <div className="text-xs text-stone-400 flex gap-3">
                      {c.phone && <span>{c.phone}</span>}
                      {c.address && <span>{c.address}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => { setEditingId(c.id); setShowCreate(false); setActionError(null); }}
                    className="p-2 rounded-lg hover:bg-stone-50 text-stone-400 hover:text-stone-700"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
