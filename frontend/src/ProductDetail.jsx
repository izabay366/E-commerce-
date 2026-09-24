import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Minus, Plus, ArrowLeft, Heart } from "lucide-react";
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

export default function ProductDetail() {
  const { id } = useParams();
  const { addItem } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setProduct(null);
    fetch(`${API_URL}/api/products/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Product not found." : `Request failed (${res.status})`);
        return res.json();
      })
      .then((body) => {
        setProduct(body.data);
        // Default to the first available variant, falling back to the first
        // variant at all if every one happens to be unavailable.
        const variants = body.data?.variants || [];
        const firstAvailable = variants.find((v) => v.is_available) || variants[0];
        setSelectedVariantId(firstAvailable?.id ?? null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const selectedVariant = useMemo(
    () => product?.variants?.find((v) => v.id === selectedVariantId) || null,
    [product, selectedVariantId]
  );

  // Stock isn't always tracked yet — a variant showing 0 stock but still
  // marked available means "not yet counted", not "sold out". This mirrors
  // the same lenient handling ProductListing.jsx already uses, so the two
  // pages agree on what "out of stock" actually means.
  const stockTracked = selectedVariant && Number(selectedVariant.stock_quantity) > 0;
  const maxQuantity = stockTracked ? Number(selectedVariant.stock_quantity) : null;
  const variantUnavailable = selectedVariant ? !selectedVariant.is_available : false;

  // Reset quantity to a valid amount whenever the selected variant changes.
  useEffect(() => {
    setQuantity(1);
    setAdded(false);
    setAddError(null);
  }, [selectedVariantId]);

  const adjustQuantity = (delta) => {
    setQuantity((q) => {
      const next = q + delta;
      if (next < 1) return 1;
      if (maxQuantity && next > maxQuantity) return maxQuantity;
      return next;
    });
  };

  const handleAddToCart = async () => {
    if (!selectedVariant || variantUnavailable) return;
    setAdding(true);
    setAddError(null);
    setAdded(false);
    try {
      // variant_id is a plain integer (product_variants.id) — never a UUID,
      // and price is never sent from here; the backend always re-reads it
      // from product_variants at add-to-cart time.
      await addItem(selectedVariant.id, quantity);
      setAdded(true);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 font-sans">
        <Header />
        <div className="max-w-4xl mx-auto px-5 pt-8 pb-24">
          <div className="grid md:grid-cols-2 gap-8 animate-pulse">
            <div className="h-80 bg-stone-100 rounded-2xl" />
            <div className="space-y-3">
              <div className="h-6 bg-stone-100 rounded w-2/3" />
              <div className="h-4 bg-stone-100 rounded w-1/3" />
              <div className="h-20 bg-stone-100 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-stone-50 font-sans">
        <Header />
        <div className="max-w-lg mx-auto px-5 pt-16 pb-24 text-center">
          <p className="text-stone-500 mb-4">{error || "Product not found."}</p>
          <Link to="/products" className="text-emerald-900 font-medium text-sm underline underline-offset-4">
            Back to all products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <Header />
      <div className="max-w-4xl mx-auto px-5 pt-6 pb-24">
        <Link to="/products" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-emerald-900 mb-5">
          <ArrowLeft className="w-4 h-4" /> Back to products
        </Link>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Image */}
          <div className="relative h-80 md:h-96 bg-stone-100 rounded-2xl overflow-hidden flex items-center justify-center">
            {resolveImage(product.image_url, product.name) ? (
              <img src={resolveImage(product.image_url, product.name)} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-stone-300 text-sm">No image</span>
            )}
            <button className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center">
              <Heart className="w-4 h-4 text-stone-400" />
            </button>
            {!product.is_available && (
              <span className="absolute top-3 left-3 bg-stone-900 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                No longer available
              </span>
            )}
          </div>

          {/* Details */}
          <div>
            {product.category?.name && (
              <p className="text-xs font-medium text-emerald-800 bg-emerald-50 inline-block px-2.5 py-1 rounded-full mb-3">
                {product.category.name}
              </p>
            )}
            <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-2">{product.name}</h1>
            {product.description && (
              <p className="text-sm text-stone-500 leading-relaxed mb-5">{product.description}</p>
            )}

            {/* Variant selector */}
            {product.variants?.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
                  {product.variants.length > 1 ? "Choose an option" : "Option"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => {
                    const isSelected = v.id === selectedVariantId;
                    const disabled = !v.is_available;
                    return (
                      <button
                        key={v.id}
                        onClick={() => !disabled && setSelectedVariantId(v.id)}
                        disabled={disabled}
                        className={`text-sm px-3.5 h-10 rounded-xl border font-medium transition-colors ${
                          disabled
                            ? "border-stone-100 text-stone-300 bg-stone-50 cursor-not-allowed line-through"
                            : isSelected
                            ? "border-emerald-800 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-300"
                        }`}
                      >
                        {v.name}{v.unit ? ` (${v.unit})` : ""} — {Number(v.price).toLocaleString()} RWF
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedVariant && (
              <>
                <p className="text-2xl font-semibold text-emerald-900 mb-1">
                  {Number(selectedVariant.price).toLocaleString()} <span className="text-sm font-normal text-stone-400">RWF</span>
                </p>

                {variantUnavailable ? (
                  <p className="text-sm text-red-500 mb-5">This option is currently unavailable.</p>
                ) : stockTracked ? (
                  <p className="text-xs text-stone-400 mb-5">{selectedVariant.stock_quantity} in stock</p>
                ) : (
                  <p className="text-xs text-amber-600 mb-5">Stock not yet tracked — orders can still be placed.</p>
                )}

                {!variantUnavailable && (
                  <>
                    <div className="flex items-center gap-3 mb-5">
                      <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Quantity</span>
                      <div className="flex items-center gap-3 border border-stone-200 rounded-full px-1">
                        <button
                          onClick={() => adjustQuantity(-1)}
                          disabled={quantity <= 1}
                          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-stone-50 disabled:opacity-30"
                        >
                          <Minus className="w-3.5 h-3.5 text-stone-600" />
                        </button>
                        <span className="text-sm font-medium w-5 text-center">{quantity}</span>
                        <button
                          onClick={() => adjustQuantity(1)}
                          disabled={maxQuantity != null && quantity >= maxQuantity}
                          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-stone-50 disabled:opacity-30"
                        >
                          <Plus className="w-3.5 h-3.5 text-stone-600" />
                        </button>
                      </div>
                    </div>

                    {addError && (
                      <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-3 mb-4">
                        {addError}
                      </div>
                    )}

                    <button
                      onClick={handleAddToCart}
                      disabled={adding}
                      className="w-full bg-emerald-900 text-white font-medium h-12 rounded-full hover:bg-emerald-800 disabled:opacity-50"
                    >
                      {adding ? "Adding..." : added ? "Added to cart ✓" : "Add to cart"}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
