import React, { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, X, ImagePlus, ImageOff } from "lucide-react";
import { useAuth } from "./AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const emptyForm = { name: "", description: "", price: "", stock_quantity: "", unit: "", category_id: "", low_stock_threshold: 5 };

// The created/updated product's id can come back in a few plausible shapes
// depending on how the backend wraps its response — try the likely ones
// before giving up, since the image upload needs a real id to attach to.
function extractProductId(body, fallbackId) {
  return body?.id || body?.data?.id || body?.product?.id || fallbackId || null;
}

export default function AdminProducts() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
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

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/products`).then((r) => r.json()),
      fetch(`${API_URL}/api/categories`).then((r) => r.json()),
    ])
      .then(([p, c]) => {
        setProducts(p.data || []);
        setCategories(c.data || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openNewForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError(null);
    setImageFile(null);
    setImagePreview(null);
    setFormOpen(true);
  };

  const openEditForm = (p) => {
    setForm({
      name: p.name,
      description: p.description || "",
      price: p.price,
      stock_quantity: p.stock_quantity,
      unit: p.unit || "",
      category_id: p.category_id || "",
      low_stock_threshold: p.low_stock_threshold ?? 5,
    });
    setEditingId(p.id);
    setFormError(null);
    setImageFile(null);
    setImagePreview(p.image_url || null);
    setFormOpen(true);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (productId) => {
    const body = new FormData();
    body.append("image", imageFile);
    const res = await fetch(`${API_URL}/api/products/${productId}/image`, {
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
    if (!form.name.trim() || !form.price || form.stock_quantity === "" || !form.category_id) {
      setFormError("Name, price, stock quantity, and category are all required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? `${API_URL}/api/products/${editingId}` : `${API_URL}/api/products`;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          stock_quantity: Number(form.stock_quantity),
          unit: form.unit.trim() || undefined,
          low_stock_threshold: Number(form.low_stock_threshold),
          category_id: form.category_id,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Save failed (${res.status})`);
      }

      // The product itself saved fine at this point. If a new image was
      // picked, upload it as a second step — a failure here shouldn't look
      // like the whole save failed, since the product data did go through.
      if (imageFile) {
        const savedBody = await res.json().catch(() => ({}));
        const productId = extractProductId(savedBody, editingId);
        if (productId) {
          try {
            await uploadImage(productId);
          } catch (imgErr) {
            setFormOpen(false);
            fetchAll();
            setError(`Product saved, but the image failed to upload: ${imgErr.message}`);
            return;
          }
        } else {
          setFormOpen(false);
          fetchAll();
          setError("Product saved, but couldn't find its id to attach the image — please edit it and re-upload.");
          return;
        }
      }

      setFormOpen(false);
      fetchAll();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product? This can't be undone.")) return;
    try {
      const res = await fetch(`${API_URL}/api/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      fetchAll();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <div className="max-w-5xl mx-auto px-5 pt-8 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-2xl font-semibold text-stone-900">Products</h1>
          <button
            onClick={openNewForm}
            className="flex items-center gap-1.5 bg-emerald-900 text-white text-sm font-medium px-4 h-10 rounded-full hover:bg-emerald-800"
          >
            <Plus className="w-4 h-4" /> Add product
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 mb-4 flex items-start justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="shrink-0"><X className="w-4 h-4" /></button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] px-4 py-3 bg-stone-50 text-xs text-stone-400 font-medium">
            <span></span>
            <span>Product</span>
            <span>Category</span>
            <span>Price</span>
            <span>Stock</span>
            <span></span>
          </div>
          {loading ? (
            <p className="text-sm text-stone-400 text-center py-10">Loading products...</p>
          ) : (
            products.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] px-4 py-3 border-t border-stone-100 items-center text-sm"
              >
                <div className="w-10 h-10 rounded-lg bg-stone-100 overflow-hidden flex items-center justify-center shrink-0">
                  {p.image_url ? (
                    <img src={p.image_url.startsWith('http') ? p.image_url : `${API_URL}${p.image_url}`} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageOff className="w-4 h-4 text-stone-300" />
                  )}
                </div>
                <span className="text-stone-900 truncate">{p.name}</span>
                <span className="text-stone-500 truncate">{p.category_name || "—"}</span>
                <span className="text-stone-900">{Number(p.price).toLocaleString()} RWF</span>
                <span className={p.stock_quantity <= (p.low_stock_threshold ?? 5) ? "text-amber-600 font-medium" : "text-stone-500"}>
                  {p.stock_quantity}
                </span>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => openEditForm(p)} className="text-stone-400 hover:text-emerald-800">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="text-stone-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit modal */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-5 z-20">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-semibold text-stone-900">
                {editingId ? "Edit product" : "Add product"}
              </h2>
              <button onClick={() => setFormOpen(false)}><X className="w-5 h-5 text-stone-400" /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              {formError && (
                <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg p-3">{formError}</div>
              )}

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

              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Product name"
                className="w-full h-10 px-3 rounded-lg border border-stone-200 text-sm"
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Description (optional)"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm"
              />
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                required
                className="w-full h-10 px-3 rounded-lg border border-stone-200 text-sm"
              >
                <option value="" disabled>Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="Price (RWF)"
                  className="h-10 px-3 rounded-lg border border-stone-200 text-sm"
                />
                <input
                  type="number"
                  value={form.stock_quantity}
                  onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                  placeholder="Stock quantity"
                  className="h-10 px-3 rounded-lg border border-stone-200 text-sm"
                />
                <input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="Unit (e.g. kg, piece)"
                  className="h-10 px-3 rounded-lg border border-stone-200 text-sm"
                />
              </div>
              <input
                type="number"
                value={form.low_stock_threshold}
                onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                placeholder="Low stock threshold"
                className="w-full h-10 px-3 rounded-lg border border-stone-200 text-sm"
              />
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-emerald-900 text-white font-medium h-11 rounded-full hover:bg-emerald-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Save changes" : "Add product"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
