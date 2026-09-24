import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, Heart, Plus, SlidersHorizontal, X } from "lucide-react";
import { useCart } from "./CartContext";
import Header from "./Header";

// ── Local product image assets ────────────────────────────────────────────────
import imgBeefBrochette    from "./assets/Beef Brochette.png";
import imgBread            from "./assets/Bread (Sliced Loaf).png";
import imgCatfish          from "./assets/Catfish (Fresh).png";
import imgChickenWhole     from "./assets/Chicken (Whole, Fresh).png";
import imgChickenBreast    from "./assets/Chicken Breast.png";
import imgChickenDrums     from "./assets/Chicken Drumsticks.png";
import imgGrilledChicken   from "./assets/Grilled Chicken Plate.png";
import imgGrilledFish      from "./assets/Grilled Fish (Tilapia).png";
import imgMineralBelle     from "./assets/Mineral Water (Belle).png";
import imgMineralNil       from "./assets/Mineral Water (nil).png";
import imgPrawns           from "./assets/Prawns (Frozen.png";
import imgRiceBeans        from "./assets/Rice & Beans Combo.png";
import imgSmokedFish       from "./assets/Smoked Fish.png";
import imgTilapia          from "./assets/Tilapia (Fresh, Whole).png";
import imgBeans            from "./assets/beans.png";
import imgBlackTea         from "./assets/black tea.png";
import imgButter           from "./assets/butter.png";
import imgCassavaFlour     from "./assets/cassava flour.png";
import imgChapati          from "./assets/chapati.png";
import imgChips            from "./assets/chips.png";
import imgEggs             from "./assets/eggs.png";
import imgFantaBig         from "./assets/fanta big.png";

import imgFreshBeef        from "./assets/fresh beef meat.png";
import imgGoatMeat         from "./assets/goat meat.png";
import imgIndagara         from "./assets/indagara.png";
import imgIrishPotatoes    from "./assets/irish patatoes.png";
import imgJuice            from "./assets/juice.png";
import imgMilkPowder       from "./assets/milk powder.png";
import imgMilkTea          from "./assets/milk tea.png";
import imgMilk             from "./assets/milk.png";
import imgMineralWater     from "./assets/mineralwater.png";
import imgMugulusu         from "./assets/mugulusu.png";
import imgOnions           from "./assets/onions.png";
import imgPeanutButter     from "./assets/peanut butter.png";
import imgRiceKigori       from "./assets/rice(kigori).png";
import imgRiceTanzania     from "./assets/rice(tanzania).png";
import imgSalt             from "./assets/salt.png";
import imgSamosa           from "./assets/samosa.png";
import imgSugar            from "./assets/sugar.png";
import imgSunflowerOil1kg  from "./assets/sunflower oil 1kg.png";
import imgSunflowerOil     from "./assets/sunflower oil.png";
import imgSweetPotatoes    from "./assets/sweet patotoes.png";
import imgThompson         from "./assets/thompson.png";
import imgTomatoes         from "./assets/tomatoes.png";
import imgWheatFlour       from "./assets/wheat flour.png";
import imgYoghurt          from "./assets/yoghurt.png";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Keyword → local asset. Order matters — more specific first.
const NAME_IMAGE_MAP = [
  ["beef brochette",       imgBeefBrochette],
  ["grilled chicken",      imgGrilledChicken],
  ["grilled fish",         imgGrilledFish],
  ["chicken breast",       imgChickenBreast],
  ["chicken drumstick",    imgChickenDrums],
  ["chicken",              imgChickenWhole],
  ["catfish",              imgCatfish],
  ["tilapia",              imgTilapia],
  ["smoked fish",          imgSmokedFish],
  ["dagaa",                imgIndagara],
  ["indagara",             imgIndagara],
  ["thompson",             imgThompson],
  ["prawns",               imgPrawns],
  ["fresh juice",          imgJuice],
  ["juice",                imgJuice],
  ["black tea",            imgBlackTea],
  ["milk tea",             imgMilkTea],
  ["milk powder",          imgMilkPowder],
  ["powdered milk",        imgMilkPowder],
  ["fresh milk",           imgMilk],
  ["milk",                 imgMilk],
  ["mineral water (belle)",imgMineralBelle],
  ["inyange",              imgMineralNil],
  ["belle",                imgMineralBelle],
  ["mineral water",        imgMineralWater],
  ["water",                imgMineralWater],
  ["fanta",                imgFantaBig],
  ["coca-cola",            imgFantaBig],
  ["soda",                 imgFantaBig],
  ["bread",                imgBread],
  ["chapati",              imgChapati],
  ["chips",                imgChips],
  ["samosa",               imgSamosa],
  ["rice & beans",         imgRiceBeans],
  ["rice and beans",       imgRiceBeans],
  ["kigori",               imgRiceKigori],
  ["tanzania",             imgRiceTanzania],
  ["rice",                 imgRiceKigori],
  ["beans",                imgBeans],
  ["eggs",                 imgEggs],
  ["butter",               imgButter],
  ["yogurt",               imgYoghurt],
  ["yoghurt",              imgYoghurt],
  ["cassava flour",        imgCassavaFlour],
  ["wheat flour",          imgWheatFlour],
  ["flour",                imgCassavaFlour],
  ["sugar",                imgSugar],
  ["salt",                 imgSalt],
  ["onion",                imgOnions],
  ["tomato",               imgTomatoes],
  ["irish potato",         imgIrishPotatoes],
  ["sweet potato",         imgSweetPotatoes],
  ["potato",               imgIrishPotatoes],
  ["peanut butter",        imgPeanutButter],
  ["sunflower oil 1",      imgSunflowerOil1kg],
  ["sunflower oil",        imgSunflowerOil],
  ["oil",                  imgSunflowerOil],
  ["goat",                 imgGoatMeat],
  ["beef",                 imgFreshBeef],
  ["mugulusu",             imgMugulusu],
];

/**
 * Returns the best image src for a product:
 * 1. Valid absolute URL from DB  → use directly
 * 2. Relative /uploads/... path  → prepend API_URL
 * 3. Match product name keywords → local bundled asset
 * 4. Fallback                    → null (shows placeholder)
 */
function resolveImage(imageUrl, name) {
  if (imageUrl) {
    if (imageUrl.startsWith("http")) return imageUrl;
    if (imageUrl.startsWith("/"))    return `${API_URL}${imageUrl}`;
  }
  const lower = (name || "").toLowerCase();
  for (const [kw, asset] of NAME_IMAGE_MAP) {
    if (lower.includes(kw)) return asset;
  }
  return null;
}

function ProductCard({ item, onAdd }) {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const outOfStock = Number(item.stock_quantity) <= 0;

  const handleAdd = async (e) => {
    e.stopPropagation(); // don't trigger the card's own click-through
    setAdding(true);
    try {
      await onAdd(item);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      onClick={() => navigate(`/product/${item.id}`)}
      className="bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="relative h-32 bg-stone-100 flex items-center justify-center">
        {resolveImage(item.image_url, item.name) ? (
          <img src={resolveImage(item.image_url, item.name)} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-stone-300 text-xs">no image</span>
        )}
        <button
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center"
        >
          <Heart className="w-3.5 h-3.5 text-stone-400" />
        </button>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-stone-900 leading-snug line-clamp-2">{item.name}</p>
        <p className="text-xs text-stone-400 mb-2">{item.category} · {item.variant}</p>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-emerald-900">
            {Number(item.price).toLocaleString()} <span className="text-[11px] font-normal text-stone-400">RWF</span>
          </p>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="w-7 h-7 rounded-full bg-emerald-800 flex items-center justify-center hover:bg-emerald-900 disabled:opacity-50"
          >
            <Plus className={`w-4 h-4 text-white ${adding ? "animate-pulse" : ""}`} />
          </button>
        </div>
        {outOfStock && (
          <p className="text-[10px] text-amber-600 mt-1">Stock not yet set — orders may still be placed</p>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden animate-pulse">
      <div className="h-32 bg-stone-100" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-stone-100 rounded w-3/4" />
        <div className="h-3 bg-stone-100 rounded w-1/2" />
        <div className="h-6 bg-stone-100 rounded w-full mt-2" />
      </div>
    </div>
  );
}

export default function ProductListing() {
  const { addItem } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get("category");
  const search = searchParams.get("search") || "";

  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(search);
  const [addError, setAddError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/products`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((data) => setAllItems(data.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const names = new Set(allItems.map((i) => i.category).filter(Boolean));
    return Array.from(names).sort();
  }, [allItems]);

  const filteredItems = useMemo(() => {
    let items = allItems;
    if (activeCategory) {
      items = items.filter((i) => i.category === activeCategory);
    }
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(term) ||
          (i.description || "").toLowerCase().includes(term)
      );
    }
    return items;
  }, [allItems, activeCategory, search]);

  const setCategory = (name) => {
    const next = new URLSearchParams(searchParams);
    if (name) next.set("category", name);
    else next.delete("category");
    setSearchParams(next);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (searchInput.trim()) next.set("search", searchInput.trim());
    else next.delete("search");
    setSearchParams(next);
  };

  const handleAddToCart = async (item) => {
    setAddError(null);
    try {
      await addItem(item.variant_id, 1);
    } catch (err) {
      setAddError(`Couldn't add "${item.name}": ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <Header />
      <div className="max-w-6xl mx-auto px-5 pt-8 pb-4">
        <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-1">
          {activeCategory || "All products"}
        </h1>
        <p className="text-sm text-stone-400">Browse everything MuhangaShop delivers</p>
      </div>

      <div className="max-w-6xl mx-auto px-5 mb-4 flex gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search products..."
            className="w-full h-10 pl-9 pr-3 rounded-full bg-white border border-stone-200 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-800/30"
          />
        </form>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className="md:hidden w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4 text-stone-500" />
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-5 grid md:grid-cols-[200px_1fr] gap-6 pb-16">
        <aside className={`${filtersOpen ? "block" : "hidden"} md:block`}>
          <div className="bg-white rounded-2xl border border-stone-200 p-3 sticky top-20">
            <div className="flex items-center justify-between mb-2 md:hidden">
              <p className="text-xs font-semibold text-stone-400 uppercase">Categories</p>
              <button onClick={() => setFiltersOpen(false)}><X className="w-4 h-4 text-stone-400" /></button>
            </div>
            <button
              onClick={() => setCategory(null)}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg mb-1 ${
                !activeCategory ? "bg-emerald-800 text-white" : "text-stone-600 hover:bg-stone-50"
              }`}
            >
              All products
            </button>
            {categories.map((name) => (
              <button
                key={name}
                onClick={() => setCategory(name)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg mb-1 ${
                  activeCategory === name ? "bg-emerald-800 text-white" : "text-stone-600 hover:bg-stone-50"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </aside>

        <main>
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 mb-4">
              Couldn't load products: {error}. Check that the backend is running at {API_URL}.
            </div>
          )}

          {addError && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl p-3 mb-4">
              {addError}
            </div>
          )}

          {!error && !loading && filteredItems.length === 0 && (
            <div className="text-center py-16">
              <p className="text-stone-400 text-sm">No products found{search ? ` for "${search}"` : ""}.</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
              : filteredItems.map((item) => (
                  <ProductCard key={item.variant_id} item={item} onAdd={handleAddToCart} />
                ))}
          </div>
        </main>
      </div>
    </div>
  );
}
