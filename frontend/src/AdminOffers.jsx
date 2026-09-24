import React, { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Percent, Gift } from "lucide-react";
import { useAuth } from "./AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ICONS = { percent: Percent, gift: Gift };

const emptyForm = {
  title: "",
  subtitle: "",
  code: "",
  icon: "percent",
  highlight: false,
  sort_order: 0,
};

export default function AdminOffers() {
  const { token } = useAuth();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchOffers = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/offers`)
      .then((r) => r.json())
      .then((body) => setOffers(body.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  const openNewForm = () => {
    setForm({ ...emptyForm, sort_order: offers.length });
    setEditingId(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (o) => {
    setForm({
      title: o.title || "",
      subtitle: o.subtitle || "",
      code: o.code || "",
      icon: o.icon || "percent",
      highlight: !!o.highlight,
      sort_order: o.sort_order ?? 0,
    });
    setEditingId(o.id);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError("Offer title is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? `${API_URL}/api/offers/${editingId}` : `${API_URL}/api/offers`;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: form.title.trim(),
          subtitle: form.subtitle.trim() || undefined,
          code: form.code.trim() || undefined,
          icon: form.icon,
          highlight: form.highlight,
          sort_order: Number(form.sort_order) || 0,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Save failed (${res.status})`);
      }
      setFormOpen(false);
      fetchOffers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (o) => {
    if (!window.confirm(`Remove "${o.title}" from the homepage?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/offers/${o.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Delete failed");
      }
      fetchOffers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-5 pt-8 pb-16">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-stone-900">Offers</h1>
          <p className="text-sm text-stone-400 mt-1">
            The three promo cards shown on the homepage, between categories and popular products.
          </p>
        </div>
        <button
          onClick={openNewForm}
          className="flex items-center gap-1.5 bg-emerald-900 text-white text-sm font-medium px-4 h-10 rounded-full hover:bg-emerald-800 shrink-0"
        >
          <Plus className="w-4 h-4" /> Add offer
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 mb-4 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="grid grid-cols-[auto_2fr_1fr_auto] px-4 py-3 bg-stone-50 text-xs text-stone-400 font-medium">
          <span></span>
          <span>Offer</span>
          <span>Style</span>
          <span></span>
        </div>
        {loading ? (
          <p className="text-sm text-stone-400 text-center py-10">Loading offers...</p>
        ) : offers.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-10">No offers yet — add your first one.</p>
        ) : (
          offers.map((o) => {
            const Icon = ICONS[o.icon] || Percent;
            return (
              <div
                key={o.id}
                className="grid grid-cols-[auto_2fr_1fr_auto] px-4 py-3 border-t border-stone-100 items-center text-sm"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    o.highlight ? "bg-emerald-900" : "bg-amber-500"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${o.highlight ? "text-white" : "text-emerald-950"}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-stone-900 font-medium truncate">{o.title}</p>
                  {(o.subtitle || o.code) && (
                    <p className="text-xs text-stone-400 truncate">
                      {o.subtitle}
                      {o.code ? ` · Code: ${o.code}` : ""}
                    </p>
                  )}
                </div>
                <span className="text-stone-500">{o.highlight ? "Highlighted" : "Standard"}</span>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => openEditForm(o)} className="text-stone-400 hover:text-emerald-800">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(o)} className="text-stone-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit modal */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-5 z-20">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-semibold text-stone-900">
                {editingId ? "Edit offer" : "Add offer"}
              </h2>
              <button onClick={() => setFormOpen(false)}><X className="w-5 h-5 text-stone-400" /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              {formError && (
                <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg p-3">{formError}</div>
              )}
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Title (e.g. 1,000 RWF off)"
                className="w-full h-10 px-3 rounded-lg border border-stone-200 text-sm"
              />
              <input
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                placeholder="Subtitle (e.g. Min. spend 10,000 RWF)"
                className="w-full h-10 px-3 rounded-lg border border-stone-200 text-sm"
              />
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="Promo code (optional, e.g. MUHANGA500)"
                className="w-full h-10 px-3 rounded-lg border border-stone-200 text-sm"
              />

              <div className="flex gap-3">
                <label className="flex-1">
                  <span className="text-xs text-stone-400 block mb-1">Icon</span>
                  <select
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-stone-200 text-sm"
                  >
                    <option value="percent">Percent (discount)</option>
                    <option value="gift">Gift (bonus/code)</option>
                  </select>
                </label>
                <label className="flex-1">
                  <span className="text-xs text-stone-400 block mb-1">Order</span>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-stone-200 text-sm"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm text-stone-600">
                <input
                  type="checkbox"
                  checked={form.highlight}
                  onChange={(e) => setForm({ ...form, highlight: e.target.checked })}
                  className="w-4 h-4"
                />
                Highlight this offer (dark card, stands out from the others)
              </label>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-emerald-900 text-white font-medium h-11 rounded-full hover:bg-emerald-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Save changes" : "Add offer"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
