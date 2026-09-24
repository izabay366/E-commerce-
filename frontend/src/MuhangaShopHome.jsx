import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "./CartContext";
import Header from "./Header";
import {
  Search, Heart, Bell, ShoppingBag, MapPin, Truck, Clock,
  Wallet, Fish, Beef, Coffee, Salad, Soup, Package, Plus, Star,
  Percent, Smartphone, QrCode, Copy, Gift, Moon
} from "lucide-react";

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
 * 4. Fallback                    → null
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

// Icon shown per category, matched by name (case-insensitive). Anything not
// listed here — including brand-new categories added later in admin — just
// falls back to a generic package icon instead of breaking.
const CATEGORY_ICONS = {
  groceries: Salad,
  beverages: Coffee,
  seafood: Fish,
  meats: Beef,
  "ready-to-eat": Soup,
};
const DEFAULT_CATEGORY_ICON = Package;

// Icon shown per offer, set by the admin when creating/editing it.
const OFFER_ICONS = { percent: Percent, gift: Gift };

// Maps a real /api/products row (same shape ProductListing.jsx uses) into
// what ProductCard below expects, so Add to Cart has a real variant_id.
function toHomeCardShape(item) {
  return {
    id: item.id,
    name: item.name,
    size: item.variant,
    price: Number(item.price),
    tag: Number(item.stock_quantity) <= 0 ? null : item.tag || null,
    image: resolveImage(item.image_url, item.name),
    variant_id: item.variant_id,
    category: item.category,
  };
}

function WeaveDivider() {
  // Agaseke-inspired woven pattern, used sparingly as the signature motif
  return (
    <svg viewBox="0 0 400 16" preserveAspectRatio="none" className="w-full h-4" aria-hidden="true">
      <defs>
        <pattern id="weave" width="20" height="16" patternUnits="userSpaceOnUse">
          <path d="M0 8 Q5 0 10 8 T20 8" fill="none" strokeWidth="2" className="stroke-amber-500" />
          <path d="M0 8 Q5 16 10 8 T20 8" fill="none" strokeWidth="2" className="stroke-emerald-800" />
        </pattern>
      </defs>
      <rect width="400" height="16" fill="url(#weave)" />
    </svg>
  );
}

function CategoryPill({ cat }) {
  const Icon = cat.icon;
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/products?category=${encodeURIComponent(cat.name)}`)}
      className="group flex flex-col items-center gap-2 shrink-0 w-24"
    >
      <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center group-hover:bg-emerald-800 transition-colors">
        <Icon className="w-6 h-6 text-emerald-800 group-hover:text-white transition-colors" strokeWidth={1.75} />
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-stone-800 leading-tight">{cat.name}</p>
        <p className="text-[11px] text-stone-400">{cat.count} items</p>
      </div>
    </button>
  );
}

function OfferCard({ offer }) {
  const Icon = OFFER_ICONS[offer.icon] || Percent;
  const detail = [offer.subtitle, offer.code ? `Code: ${offer.code}` : null].filter(Boolean).join(" · ");

  if (offer.highlight) {
    return (
      <div className="rounded-2xl bg-emerald-900 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-emerald-900" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{offer.title}</p>
          {detail && <p className="text-xs text-emerald-200">{detail}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-emerald-950" />
      </div>
      <div>
        <p className="text-sm font-semibold text-stone-900">{offer.title}</p>
        {detail && <p className="text-xs text-stone-500">{detail}</p>}
      </div>
    </div>
  );
}

function ProductCard({ p }) {
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e) => {
    e.stopPropagation();
    setAdding(true);
    try {
      await addItem(p.variant_id ?? p.id, 1);
    } catch {
      // Errors surface via the cart badge/context; keep the homepage quiet.
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      onClick={() => p.id && navigate(`/product/${p.id}`)}
      className="bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="relative h-32 bg-stone-100 flex items-center justify-center">
        {p.image ? (
          <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-stone-300 text-xs">image</span>
        )}
        {p.tag && (
          <span className="absolute top-2 left-2 bg-amber-500 text-emerald-950 text-[10px] font-semibold px-2 py-0.5 rounded-full">
            {p.tag}
          </span>
        )}
        <button
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center"
        >
          <Heart className="w-3.5 h-3.5 text-stone-400" />
        </button>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-stone-900 leading-snug">{p.name}</p>
        <p className="text-xs text-stone-400 mb-2">{p.size}</p>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-emerald-900">
            {p.price.toLocaleString()} <span className="text-[11px] font-normal text-stone-400">RWF</span>
          </p>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="w-7 h-7 rounded-full bg-emerald-800 flex items-center justify-center hover:bg-emerald-900 disabled:opacity-50"
          >
            <Plus className={`w-4 h-4 text-white ${adding ? "animate-pulse" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonTile() {
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

function ProductRow({ title, subtitle, items, seeAllCategory, loading }) {
  if (!loading && items.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-5 py-4">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-serif text-xl font-semibold text-stone-900 mb-1">{title}</h2>
          <p className="text-sm text-stone-400">{subtitle}</p>
        </div>
        <Link
          to={seeAllCategory ? `/products?category=${encodeURIComponent(seeAllCategory)}` : "/products"}
          className="text-sm text-emerald-900 font-medium"
        >
          See all →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonTile key={i} />)
          : items.map((p) => <ProductCard key={p.variant_id} p={p} />)}
      </div>
    </section>
  );
}

// Optional real image URLs — fill these in with real photos or product images.
// Leave blank/undefined and the tiles fall back to plain color backgrounds.
const heroImages = {
  tilapia: "",
  chicken: "",
};

export default function MuhangaShopHome() {
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [apiCategories, setApiCategories] = useState([]);
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/api/products`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((data) => setAllItems((data.data || []).map(toHomeCardShape)))
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));

    fetch(`${API_URL}/api/categories`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((data) => setApiCategories(data.data || []))
      .catch(() => {
        // Category tiles just won't render if this fails — the rest of the
        // homepage doesn't depend on it, so this stays quiet rather than
        // showing a second error banner next to the products one.
      });

    fetch(`${API_URL}/api/offers`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((data) => setOffers(data.data || []))
      .catch(() => {
        // Same as categories — the offers section just won't render if this
        // fails, rather than showing a second error banner.
      });
  }, []);

  // Count comes from the products already loaded above, not from the
  // backend, so this always matches what's actually in stock right now.
  const categories = useMemo(
    () =>
      apiCategories.map((c) => ({
        name: c.name,
        icon: CATEGORY_ICONS[c.name?.toLowerCase()] || DEFAULT_CATEGORY_ICON,
        count: allItems.filter((p) => p.category === c.name).length,
      })),
    [apiCategories, allItems]
  );

  // Matches by keyword rather than an exact hardcoded name — your actual
  // category might be "Ready-to-Eat / Restaurant", not just "Ready-to-Eat",
  // and this way it keeps working even if the exact wording changes later.
  const findCategoryName = (keyword) =>
    apiCategories.find((c) => c.name?.toLowerCase().includes(keyword))?.name || null;

  const seafoodCategoryName = useMemo(() => findCategoryName("seafood"), [apiCategories]);
  const readyToEatCategoryName = useMemo(() => findCategoryName("ready-to-eat") || findCategoryName("ready to eat"), [apiCategories]);

  const popular = useMemo(() => allItems.slice(0, 6), [allItems]);
  const seafoodToday = useMemo(
    () => allItems.filter((p) => p.category === seafoodCategoryName).slice(0, 6),
    [allItems, seafoodCategoryName]
  );
  const readyNow = useMemo(
    () => allItems.filter((p) => p.category === readyToEatCategoryName).slice(0, 6),
    [allItems, readyToEatCategoryName]
  );

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <Header />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-5 pt-10 pb-8">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full mb-4">
              <MapPin className="w-3 h-3" /> Delivering across Muhanga District
            </span>
            <h1 className="font-serif text-4xl md:text-5xl font-semibold text-stone-900 leading-[1.1] mb-4">
              AMISERVICE's freshest,
              <br />brought to your door.
            </h1>
            <p className="text-stone-500 text-base mb-6 max-w-sm">
              Groceries, seafood, and ready-made food from your local shop — delivered by Sector and Cell, or ready for pickup.
            </p>
            <div className="flex items-center gap-3 mb-8">
              <Link to="/products" className="bg-emerald-900 text-white font-medium px-6 h-11 flex items-center rounded-full hover:bg-emerald-800">
                Start shopping
              </Link>
              <Link
                to={readyToEatCategoryName ? `/products?category=${encodeURIComponent(readyToEatCategoryName)}` : "/products"}
                className="text-emerald-900 font-medium text-sm underline underline-offset-4"
              >
                See today's menu
              </Link>
            </div>
            <div className="flex flex-wrap gap-5 text-xs text-stone-500">
              <span className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Delivery or pickup</span>
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Same-day in Muhanga</span>
              <span className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> MoMo or cash</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-2xl bg-emerald-900 h-44 flex items-end p-4 bg-cover bg-center"
              style={{ backgroundImage: heroImages.tilapia ? `url(${heroImages.tilapia})` : undefined }}
            >
              <p className="text-white text-sm font-medium drop-shadow">Fresh tilapia, daily catch</p>
            </div>
            <div
              className="rounded-2xl bg-amber-100 h-44 flex items-end p-4 bg-cover bg-center"
              style={{ backgroundImage: heroImages.chicken ? `url(${heroImages.chicken})` : undefined }}
            >
              <p className="text-emerald-950 text-sm font-medium drop-shadow">Grilled chicken, ready now</p>
            </div>
            <div className="rounded-2xl bg-stone-200 h-28 col-span-2 flex items-end p-4">
              <p className="text-stone-700 text-sm font-medium">This week: fresh produce from local farms</p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-5"><WeaveDivider /></div>

      {/* Categories */}
      <section className="max-w-6xl mx-auto px-5 py-8">
        <h2 className="font-serif text-xl font-semibold text-stone-900 mb-1">Shop by category</h2>
        <p className="text-sm text-stone-400 mb-5">Everything from your shop, organized</p>
        <div className="flex gap-5 overflow-x-auto pb-2">
          {categories.map((c) => <CategoryPill key={c.name} cat={c} />)}
        </div>
      </section>

      {/* Offers — pulled from /api/offers, edited by the shop owner in Admin > Offers */}
      {offers.length > 0 && (
        <section id="offers" className="max-w-6xl mx-auto px-5 py-4">
          <div className="grid sm:grid-cols-3 gap-3">
            {offers.map((o) => <OfferCard key={o.id} offer={o} />)}
          </div>
        </section>
      )}

      {loadError && (
        <div className="max-w-6xl mx-auto px-5">
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4">
            Couldn't load products: {loadError}. Check that the backend is running at {API_URL}.
          </div>
        </div>
      )}

      {/* Popular products */}
      <ProductRow title="Popular this week" subtitle="What Muhanga is ordering most" items={popular} loading={loading} />

      {/* Order cutoff banner */}
      <section className="max-w-6xl mx-auto px-5 py-2">
        <div className="bg-stone-900 rounded-2xl px-6 py-4 flex items-center gap-3">
          <Moon className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-white">Order before 8pm for same-day delivery</p>
            <p className="text-xs text-stone-400">Orders after 8pm go out first thing the next morning</p>
          </div>
        </div>
      </section>

      {/* Seafood today */}
      <ProductRow title="Seafood, fresh today" subtitle="Straight from the market this morning" items={seafoodToday} seeAllCategory={seafoodCategoryName} loading={loading} />

      {/* Ready to eat */}
      <ProductRow title="Ready to eat now" subtitle="No prep, no wait" items={readyNow} seeAllCategory={readyToEatCategoryName} loading={loading} />

      {/* Trust strip */}
      <section className="max-w-6xl mx-auto px-5 py-10">
        <div className="bg-emerald-900 rounded-2xl p-6 grid sm:grid-cols-3 gap-6 text-white">
          <div className="flex items-center gap-3">
            <Star className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-sm font-medium">Fresh, sourced daily</p>
              <p className="text-xs text-emerald-200">Straight from the shop, no middlemen</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-sm font-medium">Sector & Cell delivery</p>
              <p className="text-xs text-emerald-200">Or pick up at the shop, your choice</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Wallet className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-sm font-medium">Pay your way</p>
              <p className="text-xs text-emerald-200">Mobile Money or cash on delivery</p>
            </div>
          </div>
        </div>
      </section>

      {/* App teaser (Phase 2) */}
      <section className="max-w-6xl mx-auto px-5 py-10">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 grid md:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full mb-3">
              <Smartphone className="w-3 h-3" /> Coming soon
            </span>
            <h3 className="font-serif text-2xl font-semibold text-stone-900 mb-2">The AMI SERVICES app</h3>
            <p className="text-sm text-stone-500 max-w-sm mb-4">
              Track orders live and reorder your usual basket in one tap — built once the website is stable, using the same account and order history you already have.
            </p>
            <button className="text-sm text-emerald-900 font-medium underline underline-offset-4">
              Get notified when it launches
            </button>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-28 h-28 rounded-xl bg-stone-100 flex items-center justify-center">
              <QrCode className="w-10 h-10 text-stone-300" />
            </div>
            <button className="flex items-center gap-1 text-xs text-stone-400">
              <Copy className="w-3 h-3" /> Copy link
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 mt-6">
        <div className="max-w-6xl mx-auto px-5 py-10 grid sm:grid-cols-4 gap-8">
          <div>
            <span className="font-serif text-lg font-semibold text-emerald-900">
              AMI<span className="text-amber-500">SERVICES</span>
            </span>
            <p className="text-sm text-stone-400 mt-2 max-w-xs">
              Your local shop for groceries, seafood, meat, and ready-made food — delivered across Muhanga District.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Shop</p>
            <ul className="space-y-2 text-sm text-stone-600">
              <li><Link to="/products" className="hover:text-emerald-900">Categories</Link></li>
              <li><Link to="/products?category=Ready-to-Eat" className="hover:text-emerald-900">Today's menu</Link></li>
              <li><a href="#offers" className="hover:text-emerald-900">Offers</a></li>
              <li><Link to="/track" className="hover:text-emerald-900">Track an order</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Account</p>
            <ul className="space-y-2 text-sm text-stone-600">
              <li><Link to="/orders" className="hover:text-emerald-900">My orders</Link></li>
              <li><Link to="/favorites" className="hover:text-emerald-900">Favorites</Link></li>
              <li><Link to="/account" className="hover:text-emerald-900">Delivery addresses</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Help</p>
            <ul className="space-y-2 text-sm text-stone-600">
              <li><Link to="/delivery-areas" className="hover:text-emerald-900">Delivery areas</Link></li>
              <li><Link to="/contact" className="hover:text-emerald-900">Contact the shop</Link></li>
              <li><Link to="/faq" className="hover:text-emerald-900">FAQ</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-stone-200">
          <p className="max-w-6xl mx-auto px-5 py-4 text-xs text-stone-400">
            AMI SERVICES · Serving Muhanga District, Rwanda
          </p>
        </div>
      </footer>
    </div>
  );
}
