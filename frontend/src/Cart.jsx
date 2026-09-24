import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from "lucide-react";
import { useCart } from "./CartContext";

export default function Cart() {
  const { cart, loading, error, updateItemQuantity, removeItem } = useCart();
  const navigate = useNavigate();
  const [busyItemId, setBusyItemId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const items = cart?.items || [];
  const subtotal = cart?.subtotal || 0;

  const handleQuantityChange = async (item, delta) => {
    const newQty = item.quantity + delta;
    if (newQty < 1) return;
    setBusyItemId(item.id);
    setActionError(null);
    try {
      await updateItemQuantity(item.id, newQty);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyItemId(null);
    }
  };

  const handleRemove = async (item) => {
    setBusyItemId(item.id);
    setActionError(null);
    try {
      await removeItem(item.id);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyItemId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-sm text-stone-400">Loading your cart...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <div className="max-w-3xl mx-auto px-5 pt-8 pb-24">
        <Link to="/products" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-emerald-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> Continue shopping
        </Link>

        <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-6">Your cart</h1>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 mb-4">
            Couldn't load your cart: {error}
          </div>
        )}

        {actionError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl p-3 mb-4">
            {actionError}
          </div>
        )}

        {!error && items.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-200">
            <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 text-sm mb-4">Your cart is empty</p>
            <Link
              to="/products"
              className="inline-block bg-emerald-900 text-white text-sm font-medium px-5 h-10 leading-10 rounded-full hover:bg-emerald-800"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100 mb-6">
              {items.map((item) => (
                <div key={item.id} className="p-3 sm:p-4 flex items-start sm:items-center gap-3 sm:gap-4">
                  {/* Thumbnail */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
                    <span className="text-stone-300 text-[10px]">image</span>
                  </div>

                  {/* Name + price info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">{item.product_name}</p>
                    <p className="text-xs text-stone-400">{item.variant_name}</p>
                    {/* On mobile: price and subtotal sit below the name */}
                    <div className="flex items-center gap-2 mt-1 sm:hidden">
                      <p className="text-xs text-stone-500">{Number(item.unit_price).toLocaleString()} RWF each</p>
                      <span className="text-stone-300">·</span>
                      <p className="text-sm font-semibold text-emerald-900">{Number(item.subtotal).toLocaleString()} RWF</p>
                    </div>
                    {/* Desktop: only unit price here */}
                    <p className="hidden sm:block text-sm font-semibold text-emerald-900 mt-1">
                      {Number(item.unit_price).toLocaleString()} RWF
                    </p>
                  </div>

                  {/* Qty controls */}
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <button
                      onClick={() => handleQuantityChange(item, -1)}
                      disabled={busyItemId === item.id}
                      className="w-7 h-7 rounded-full border border-stone-200 flex items-center justify-center hover:bg-stone-50 disabled:opacity-50"
                    >
                      <Minus className="w-3 h-3 text-stone-600" />
                    </button>
                    <span className="text-sm font-medium w-5 text-center">{item.quantity}</span>
                    <button
                      onClick={() => handleQuantityChange(item, 1)}
                      disabled={busyItemId === item.id}
                      className="w-7 h-7 rounded-full border border-stone-200 flex items-center justify-center hover:bg-stone-50 disabled:opacity-50"
                    >
                      <Plus className="w-3 h-3 text-stone-600" />
                    </button>
                  </div>

                  {/* Subtotal — desktop only (shown inline with mobile price above) */}
                  <p className="hidden sm:block text-sm font-semibold text-stone-900 w-20 text-right shrink-0">
                    {Number(item.subtotal).toLocaleString()} RWF
                  </p>

                  {/* Remove */}
                  <button
                    onClick={() => handleRemove(item)}
                    disabled={busyItemId === item.id}
                    className="text-stone-300 hover:text-red-500 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 p-5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-stone-500">Subtotal</span>
                <span className="text-sm font-medium text-stone-900">{Number(subtotal).toLocaleString()} RWF</span>
              </div>
              <p className="text-xs text-stone-400 mb-4">Delivery fee calculated at checkout</p>
              <button
                onClick={() => navigate("/checkout")}
                className="w-full bg-emerald-900 text-white font-medium h-11 rounded-full hover:bg-emerald-800"
              >
                Proceed to checkout
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
