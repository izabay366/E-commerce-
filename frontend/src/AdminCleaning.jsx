import React, { useState, useEffect, useCallback } from "react";
import { Sparkles, Plus, Pencil, Eye, EyeOff, X, Check, AlertCircle } from "lucide-react";
import { useAuth } from "./AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function ServiceForm({ initial, onSave, onCancel, saving }) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [basePrice, setBasePrice] = useState(initial?.base_price ?? "");
  const [duration, setDuration] = useState(initial?.estimated_duration || "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name,
      description: description || undefined,
      base_price: basePrice !== "" ? Number(basePrice) : undefined,
      estimated_duration: duration || undefined,
      is_active: isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Service Name *</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Home Deep Clean"
          className="w-full h-9 px-3 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/20"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Describe what's included..."
          className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-800/20"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Base Price (RWF)</label>
          <input
            type="number"
            min="0"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            placeholder="e.g. 5000"
            className="w-full h-9 px-3 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Estimated Duration</label>
          <input
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="e.g. 2 hours"
            className="w-full h-9 px-3 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/20"
          />
        </div>
      </div>
      {initial && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-stone-300"
          />
          <span className="text-sm text-stone-700">Active (visible to customers)</span>
        </label>
      )}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 bg-emerald-900 text-white text-sm px-4 h-9 rounded-lg hover:bg-emerald-800 disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" />
          {saving ? "Saving..." : initial ? "Save changes" : "Create service"}
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

export default function AdminCleaning() {
  const { token } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState(null);

  const fetchServices = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/cleaning-services/admin`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setServices(d.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const authHeader = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const handleCreate = async (data) => {
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_URL}/api/cleaning-services`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.errors?.join(", ") || body?.message || "Failed to create.");
      setShowCreate(false);
      fetchServices();
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
      const res = await fetch(`${API_URL}/api/cleaning-services/${id}`, {
        method: "PATCH",
        headers: authHeader,
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message || "Failed to update.");
      setEditingId(null);
      fetchServices();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (svc) => {
    setActionError(null);
    try {
      const res = await fetch(`${API_URL}/api/cleaning-services/${svc.id}`, {
        method: "PATCH",
        headers: authHeader,
        body: JSON.stringify({ is_active: !svc.is_active }),
      });
      if (!res.ok) throw new Error("Failed to update.");
      fetchServices();
    } catch (e) {
      setActionError(e.message);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Cleaning Services</h1>
          <p className="text-sm text-stone-400 mt-0.5">Manage available cleaning services</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setEditingId(null); setActionError(null); }}
          className="flex items-center gap-1.5 bg-emerald-900 text-white text-sm px-4 h-9 rounded-lg hover:bg-emerald-800"
        >
          <Plus className="w-4 h-4" /> Add service
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
          <h3 className="text-sm font-semibold text-stone-900 mb-4">New Service</h3>
          <ServiceForm
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
            saving={saving}
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-stone-100 p-5 h-20 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      ) : services.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-stone-200">
          <Sparkles className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 text-sm">No services yet. Create one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((svc) => (
            <div key={svc.id} className={`bg-white rounded-2xl border p-5 ${svc.is_active ? "border-stone-200" : "border-stone-100 opacity-60"}`}>
              {editingId === svc.id ? (
                <>
                  <h3 className="text-sm font-semibold text-stone-900 mb-4">Edit Service</h3>
                  <ServiceForm
                    initial={svc}
                    onSave={(data) => handleUpdate(svc.id, data)}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                  />
                </>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-stone-900 text-sm">{svc.name}</p>
                      {!svc.is_active && (
                        <span className="text-[10px] font-medium bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                          Inactive
                        </span>
                      )}
                    </div>
                    {svc.description && (
                      <p className="text-xs text-stone-500 line-clamp-1 mb-1">{svc.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-stone-400">
                      {svc.base_price !== null && (
                        <span className="text-emerald-700 font-semibold">
                          {Number(svc.base_price).toLocaleString()} RWF
                        </span>
                      )}
                      {svc.estimated_duration && <span>{svc.estimated_duration}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggle(svc)}
                      title={svc.is_active ? "Deactivate" : "Activate"}
                      className="p-2 rounded-lg hover:bg-stone-50 text-stone-400 hover:text-stone-700"
                    >
                      {svc.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => { setEditingId(svc.id); setShowCreate(false); setActionError(null); }}
                      className="p-2 rounded-lg hover:bg-stone-50 text-stone-400 hover:text-stone-700"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
