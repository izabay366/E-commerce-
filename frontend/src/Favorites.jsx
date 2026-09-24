import React from "react";
import { Link } from "react-router-dom";
import { Heart, Trash2 } from "lucide-react";
import { useFavorites } from "./FavoritesContext";
import Header from "./Header";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";


export default function Favorites() {
  const { favorites, loading, toggleFavorite } = useFavorites();

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <Header />
      <div className="max-w-4xl mx-auto px-5 pt-8 pb-24">
        <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-1">Favorites</h1>
        <p className="text-sm text-stone-400 mb-6">Products you've saved</p>

        {loading ? (
          <p className="text-sm text-stone-400 text-center py-16">Loading your favorites...</p>
        ) : favorites.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-200">
            <Heart className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 text-sm mb-4">No favorites yet</p>
            <Link
              to="/products"
              className="inline-block bg-emerald-900 text-white text-sm font-medium px-5 h-10 leading-10 rounded-full hover:bg-emerald-800"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {favorites.map((f) => (
              <div key={f.favorite_id} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="relative h-32 bg-stone-100 flex items-center justify-center">
                  {f.image_url ? (
                    <img src={f.image_url.startsWith('http') ? f.image_url : `${API_URL}${f.image_url}`} alt={f.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-stone-300 text-xs">no image</span>
                  )}
                  <button
                    onClick={() => toggleFavorite(f.product_id)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-stone-400 hover:text-red-500" />
                  </button>
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-stone-900 leading-snug line-clamp-2">{f.name}</p>
                  <p className="text-xs text-stone-400">{f.category}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
