import React, { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, X, ImagePlus, ImageOff } from "lucide-react";
import { useAuth } from "./AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const emptyForm = { name: "", description: "" };

export default function AdminCategories() {
  const { token } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  const fetchCategories = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/categories`)
      .then((r) => r.json())
      .then((body) => setCategories(body.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openNewForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError(null);
    setImageFile(null);
    setImagePreview(null);
    setFormOpen(true);
  };

  const openEditForm = (c) => {
    setForm({
      name: c.name || "",
      description: c.description || "",
    });
    setEditingId(c.id);
    setFormError(null);
    setImageFile(null);
    setImagePreview(c.image_url || null);
    setFormOpen(true);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (categoryId) => {
    const body = new FormData();
    body.append("image", imageFile);
    const res = await fetch(`${API_URL}/api/categories/${categoryId}/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }, // no Content-Type — browser sets the multipart boundary
      body,
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.message || `Image upload failed (${res.status})`);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("Category name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? `${API_URL}/api/categories/${editingId}` : `${API_URL}/api/categories`;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Save failed (${res.status})`);
      }

      // The category itself saved fine at this point. If a new photo was
      // picked, upload it as a second step — a failure here shouldn't look
      // like the whole save failed, since the category data did go through.
      if (imageFile) {
        const savedBody = await res.json().catch(() => ({}));
        const categoryId = savedBody?.data?.id || editingId;
        if (categoryId) {
          try {
            await uploadImage(categoryId);
          } catch (imgErr) {
            setFormOpen(false);
            fetchCategories();
            setError(`Category saved, but the photo failed to upload: ${imgErr.message}`);
            return;
          }
        }
      }

      setFormOpen(false);
      fetchCategories();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c) => {
    const warning =
      c.product_count > 0
        ? `"${c.name}" still has ${c.product_count} product${c.product_count === 1 ? "" : "s"} in it. Deleting it won't remove those products, but this category will stop showing up on the shop. Continue?`
        : `Delete "${c.name}"? This can't be undone.`;
    if (!window.confirm(warning)) return;

    try {
      const res = await fetch(`${API_URL}/api/categories/${c.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Delete failed");
      }
      fetchCategories();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-5 pt-8 pb-16">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-stone-900">Categories</h1>
          <p className="text-sm text-stone-400 mt-1">
            Control what customers can shop by — including today's "Ready to eat" menu.
          </p>
        </div>
        <button
          onClick={openNewForm}
          className="flex items-center gap-1.5 bg-emerald-900 text-white text-sm font-medium px-4 h-10 rounded-full hover:bg-emerald-800 shrink-0"
        >
          <Plus className="w-4 h-4" /> Add category
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
          <span>Category</span>
          <span>Products</span>
          <span></span>
        </div>
        {loading ? (
          <p className="text-sm text-stone-400 text-center py-10">Loading categories...</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-10">No categories yet — add your first one.</p>
        ) : (
          categories.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-[auto_2fr_1fr_auto] px-4 py-3 border-t border-stone-100 items-center text-sm"
            >
              <div className="w-10 h-10 rounded-lg bg-stone-100 overflow-hidden flex items-center justify-center shrink-0">
                {c.image_url ? (
                  <img src={c.image_url.startsWith('http') ? c.image_url : `${API_URL}${c.image_url}`} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageOff className="w-4 h-4 text-stone-300" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-stone-900 font-medium truncate">{c.name}</p>
                {c.description && <p className="text-xs text-stone-400 truncate">{c.description}</p>}
              </div>
              <span className="text-stone-500">{c.product_count ?? 0}</span>
              <div className="flex gap-2 justify-end">
                <button onClick={() => openEditForm(c)} className="text-stone-400 hover:text-emerald-800">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(c)} className="text-stone-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit modal */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-5 z-20">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-semibold text-stone-900">
                {editingId ? "Edit category" : "Add category"}
              </h2>
              <button onClick={() => setFormOpen(false)}><X className="w-5 h-5 text-stone-400" /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              {formError && (
                <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg p-3">{formError}</div>
              )}
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Category name"
                className="w-full h-10 px-3 rounded-lg border border-stone-200 text-sm"
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Description (optional)"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm"
              />

              {/* Image picker */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-28 rounded-lg border border-dashed border-stone-300 flex items-center justify-center overflow-hidden hover:border-emerald-400"
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center gap-1 text-stone-400 text-xs">
                      <ImagePlus className="w-5 h-5" /> Add a photo
                    </span>
                  )}
                </button>
                {editingId && !imageFile && (
                  <p className="text-xs text-stone-400 mt-1">
                    {imagePreview ? "Click to replace the current photo." : "No photo yet — click to add one."}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-emerald-900 text-white font-medium h-11 rounded-full hover:bg-emerald-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Save changes" : "Add category"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
