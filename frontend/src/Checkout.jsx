import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Store, Wallet, Banknote, Copy, Check } from "lucide-react";
import { useCart } from "./CartContext";
import { useAuth } from "./AuthContext";
import Header from "./Header";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
// Namespaced per-account (by user id) — a single shared key would let one
// account's saved address leak into a different account's checkout on the
// same browser (the same bug fixed in Account.jsx). Guests without a login
// share one "guest" bucket, same as before.
function rememberedDetailsKey(userId) {
  return `muhangashop_checkout_details:${userId || "guest"}`;
}

// Backend JWTs don't have a guaranteed shape — try the field names a
// registration/login response would plausibly use. If none match, the
// logged-in user just sees an empty form like before (no crash, no guess).
function nameFromUser(user) {
  if (!user) return "";
  if (user.name) return user.name;
  if (user.first_name || user.last_name) {
    return [user.first_name, user.last_name].filter(Boolean).join(" ");
  }
  return "";
}

function phoneFromUser(user) {
  if (!user) return "";
  return user.phone || user.phone_number || "";
}

// Until there's a backend "saved address" endpoint, remember the last
// checkout details in this browser so returning guests (logged in or not)
// don't have to retype them every time.
function loadRememberedDetails(userId) {
  try {
    return JSON.parse(localStorage.getItem(rememberedDetailsKey(userId)) || "null");
  } catch {
    return null;
  }
}

function saveRememberedDetails(userId, details) {
  try {
    localStorage.setItem(rememberedDetailsKey(userId), JSON.stringify(details));
  } catch {
    // Best-effort only — checkout still works without this.
  }
}

// ── Muhanga District delivery areas ──────────────────────────────────────────
// Two sectors currently served: Nyamabuye and Shyogwe.
// Each sector lists its cells; each cell lists its villages.
const MUHANGA_AREAS = {
  Nyamabuye: {
    Gahogo: [
      "Kamazuru", "Kamugina", "Nyarucyamu I", "Nyarucyamu II", "Nyarucyamu III",
      "Rutenga", "Ruvumera",
    ],
    Gitarama: [
      "Gatika", "Kagitarama", "Kavumu", "Nyabisindu",
    ],
    Gifumba: [
      "Gifumba", "Rugarama",
    ],
  },
  Shyogwe: {
    Kinini: [
      "Gatare", "Kabungo", "Kinyami", "Musezero", "Nyakabingo", "Nyakaguhu",
    ],
    Mbare: [
      "Buriza", "Muremberi", "Rubugurizo", "Songa", "Vunga",
    ],
    Mubuga: [
      "Gakomeye", "Gasharu", "Kigarama", "Mapfundo", "Matsinsi",
      "Nyamaganda", "Nyarucyamu", "Rwamaraba",
    ],
    Ruli: [
      "Cyakabiri", "Gakombe", "Kabeza", "Murambi",
    ],
  },
};

const SECTOR_NAMES = Object.keys(MUHANGA_AREAS);
function getCells(sector) { return sector ? Object.keys(MUHANGA_AREAS[sector] || {}) : []; }
function getVillages(sector, cell) { return (MUHANGA_AREAS[sector] || {})[cell] || []; }

// Update these if the numbers change — used to build the pre-filled MoMo/Airtel USSD codes below.
const MOMO_PAYMENT_INFO = {
  mtnNumber: "07901722383",
  mtnMerchantCode: "268011",
  // No Airtel Money number on file yet — add one here (e.g. airtelNumber: "073...") to show it too.
  airtelNumber: null,
};

function CopyableRow({ label, value, hint }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can fail (e.g. insecure context); the value is still visible to copy manually.
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] text-stone-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-stone-900 truncate">{value}</p>
        {hint && <p className="text-xs text-stone-400 mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 flex items-center gap-1 text-xs font-medium text-emerald-800 border border-emerald-200 rounded-full px-3 h-8 hover:bg-emerald-50"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function validateField(field, values) {
  switch (field) {
    case "name":
      return values.name.trim() ? null : "Enter your full name.";
    case "phone":
      return values.phone.trim() ? null : "Enter your phone number.";
    case "sector":
      return values.fulfillment === "delivery" && !values.sector ? "Choose your sector." : null;
    case "cell":
      return values.fulfillment === "delivery" && !values.cell ? "Choose your cell." : null;
    case "village":
      return values.fulfillment === "delivery" && !values.village ? "Choose your village." : null;
    default:
      return null;
  }
}

// Backend returns generic strings like "customer_name is required." — map
// them to the field that should show the error, instead of one banner.
function mapServerErrorsToFields(errors) {
  const fieldErrors = {};
  const general = [];
  for (const msg of errors) {
    const lower = msg.toLowerCase();
    if (lower.includes("customer_name") || lower.includes("name")) fieldErrors.name = msg;
    else if (lower.includes("phone")) fieldErrors.phone = msg;
    else if (lower.includes("sector")) fieldErrors.sector = msg;
    else if (lower.includes("cell")) fieldErrors.cell = msg;
    else general.push(msg);
  }
  return { fieldErrors, general };
}

function FieldError({ message }) {
  if (!message) return null;
  return <p className="text-xs text-red-600 mt-1">{message}</p>;
}

export default function Checkout() {
  const { cart, clearCart } = useCart();
  const { isLoggedIn, user, token } = useAuth();
  const navigate = useNavigate();

  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [fulfillment, setFulfillment] = useState("delivery"); // 'delivery' | 'pickup'
  const [sector, setSector] = useState("");
  const [cell, setCell] = useState("");
  const [village, setVillage] = useState("");
  const [landmark, setLandmark] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash_on_delivery"); // 'cash_on_delivery' | 'momo'
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});

  // When sector changes, reset downstream selections
  const handleSectorChange = (e) => {
    const val = e.target.value;
    setSector(val);
    setCell("");
    setVillage("");
    if (touched.sector) {
      setFieldErrors((prev) => ({
        ...prev,
        sector: val ? null : "Choose a sector.",
        cell: null,
        village: null,
      }));
    }
  };

  // When cell changes, reset village
  const handleCellChange = (e) => {
    const val = e.target.value;
    setCell(val);
    setVillage("");
    if (touched.cell) {
      setFieldErrors((prev) => ({
        ...prev,
        cell: val ? null : "Choose a cell.",
        village: null,
      }));
    }
  };

  // Prefill once on load: prefer the logged-in account's own details, then
  // fall back to whatever this browser remembers from a past checkout.
  useEffect(() => {
    const remembered = loadRememberedDetails(isLoggedIn ? user?.userId : null);
    const accountName = isLoggedIn ? nameFromUser(user) : "";
    const accountPhone = isLoggedIn ? phoneFromUser(user) : "";

    setGuestName(accountName || remembered?.name || "");
    setGuestPhone(accountPhone || remembered?.phone || "");
    // Only restore sector/cell/village if they are still valid options
    const remSector = remembered?.sector || "";
    const remCell = remembered?.cell || "";
    const remVillage = remembered?.village || "";
    if (SECTOR_NAMES.includes(remSector)) {
      setSector(remSector);
      if (getCells(remSector).includes(remCell)) {
        setCell(remCell);
        if (getVillages(remSector, remCell).includes(remVillage)) {
          setVillage(remVillage);
        }
      }
    }
    setLandmark(remembered?.landmark || "");
    // Only run once on mount — after this the person is free to edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = cart?.items || [];
  const subtotal = cart?.subtotal || 0;

  const fieldValues = { name: guestName, phone: guestPhone, sector, cell, village, fulfillment };

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setFieldErrors((prev) => ({ ...prev, [field]: validateField(field, fieldValues) }));
  };

  const setFieldAndValidate = (field, setter) => (e) => {
    setter(e.target.value);
    if (touched[field]) {
      const next = { ...fieldValues, [field]: e.target.value };
      setFieldErrors((prev) => ({ ...prev, [field]: validateField(field, next) }));
    }
  };

  const validateAll = () => {
    const errors = {};
    const fields = fulfillment === "delivery"
      ? ["name", "phone", "sector", "cell", "village"]
      : ["name", "phone"];
    fields.forEach((field) => {
      const msg = validateField(field, fieldValues);
      if (msg) errors[field] = msg;
    });
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (items.length === 0) {
      setFormError("Your cart is empty.");
      return;
    }
    const errors = validateAll();
    setFieldErrors(errors);
    setTouched({ name: true, phone: true, sector: true, cell: true, village: true });
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);

    const payload = {
      cart_id: cart.id,
      fulfillment_type: fulfillment.toUpperCase(),
      payment_method: paymentMethod === "momo" ? "MOBILE_MONEY" : "CASH_ON_DELIVERY",
      customer_name: guestName.trim(),
      customer_phone: guestPhone.trim(),
      ...(fulfillment === "delivery"
        ? {
            address: [sector, cell, village, landmark.trim()]
              .filter(Boolean)
              .join(", "),
          }
        : {}),
    };

    try {
      const res = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(isLoggedIn && token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (Array.isArray(body.errors) && body.errors.length > 0) {
          const { fieldErrors: mapped, general } = mapServerErrorsToFields(body.errors);
          setFieldErrors((prev) => ({ ...prev, ...mapped }));
          if (general.length > 0) setFormError(general.join(" "));
        } else {
          setFormError(body.message || `Order failed (${res.status})`);
        }
        return;
      }

      saveRememberedDetails(isLoggedIn ? user?.userId : null, {
        name: guestName.trim(),
        phone: guestPhone.trim(),
        sector,
        cell,
        village,
        landmark: landmark.trim(),
      });

      const body = await res.json();
      const createdOrder = body.order;
      await clearCart();
      navigate(`/orders/${createdOrder.id}/confirmation`, { state: { order: createdOrder } });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field) =>
    `w-full h-10 px-3 rounded-lg border text-sm focus:outline-none focus:ring-2 ${
      fieldErrors[field]
        ? "border-red-300 focus:ring-red-200"
        : "border-stone-200 focus:ring-emerald-800/30"
    }`;

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <Header />
      <div className="max-w-2xl mx-auto px-5 pt-8 pb-24">
        <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-6">Checkout</h1>

        {formError && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 mb-5">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Guest details — every customer checks out as a guest */}
          <section className="bg-white rounded-2xl border border-stone-200 p-5">
            <h2 className="text-sm font-semibold text-stone-900 mb-3">Your details</h2>
            <div className="space-y-3">
              <div>
                <input
                  value={guestName}
                  onChange={setFieldAndValidate("name", setGuestName)}
                  onBlur={handleBlur("name")}
                  placeholder="Full name"
                  className={inputClass("name")}
                />
                <FieldError message={fieldErrors.name} />
              </div>
              <div>
                <input
                  value={guestPhone}
                  onChange={setFieldAndValidate("phone", setGuestPhone)}
                  onBlur={handleBlur("phone")}
                  placeholder="Phone number"
                  className={inputClass("phone")}
                />
                <FieldError message={fieldErrors.phone} />
              </div>
            </div>
          </section>

          {/* Fulfillment */}
          <section className="bg-white rounded-2xl border border-stone-200 p-5">
            <h2 className="text-sm font-semibold text-stone-900 mb-3">Delivery or pickup</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => setFulfillment("delivery")}
                className={`flex items-center gap-2 justify-center h-11 rounded-xl border text-sm font-medium ${
                  fulfillment === "delivery"
                    ? "border-emerald-800 bg-emerald-50 text-emerald-900"
                    : "border-stone-200 text-stone-500"
                }`}
              >
                <Truck className="w-4 h-4" /> Delivery
              </button>
              <button
                type="button"
                onClick={() => setFulfillment("pickup")}
                className={`flex items-center gap-2 justify-center h-11 rounded-xl border text-sm font-medium ${
                  fulfillment === "pickup"
                    ? "border-emerald-800 bg-emerald-50 text-emerald-900"
                    : "border-stone-200 text-stone-500"
                }`}
              >
                <Store className="w-4 h-4" /> Shop pickup
              </button>
            </div>

          {fulfillment === "delivery" && (
            <div className="space-y-3">
              {/* Sector */}
              <div>
                <label className="text-xs font-medium text-stone-500 mb-1 block">Sector</label>
                <select
                  value={sector}
                  onChange={handleSectorChange}
                  onBlur={() => {
                    setTouched((p) => ({ ...p, sector: true }));
                    setFieldErrors((p) => ({ ...p, sector: validateField("sector", fieldValues) }));
                  }}
                  className={`w-full h-10 px-3 rounded-lg border text-sm focus:outline-none focus:ring-2 bg-white ${
                    fieldErrors.sector
                      ? "border-red-300 focus:ring-red-200"
                      : "border-stone-200 focus:ring-emerald-800/30"
                  }`}
                >
                  <option value="">— Choose sector —</option>
                  {SECTOR_NAMES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <FieldError message={fieldErrors.sector} />
              </div>

              {/* Cell — only shown once sector is chosen */}
              {sector && (
                <div>
                  <label className="text-xs font-medium text-stone-500 mb-1 block">Cell</label>
                  <select
                    value={cell}
                    onChange={handleCellChange}
                    onBlur={() => {
                      setTouched((p) => ({ ...p, cell: true }));
                      setFieldErrors((p) => ({ ...p, cell: validateField("cell", fieldValues) }));
                    }}
                    className={`w-full h-10 px-3 rounded-lg border text-sm focus:outline-none focus:ring-2 bg-white ${
                      fieldErrors.cell
                        ? "border-red-300 focus:ring-red-200"
                        : "border-stone-200 focus:ring-emerald-800/30"
                    }`}
                  >
                    <option value="">— Choose cell —</option>
                    {getCells(sector).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <FieldError message={fieldErrors.cell} />
                </div>
              )}

              {/* Village — only shown once cell is chosen */}
              {sector && cell && (
                <div>
                  <label className="text-xs font-medium text-stone-500 mb-1 block">Village</label>
                  <select
                    value={village}
                    onChange={(e) => {
                      setVillage(e.target.value);
                      if (touched.village) {
                        setFieldErrors((p) => ({
                          ...p,
                          village: e.target.value ? null : "Choose your village.",
                        }));
                      }
                    }}
                    onBlur={() => {
                      setTouched((p) => ({ ...p, village: true }));
                      setFieldErrors((p) => ({ ...p, village: validateField("village", fieldValues) }));
                    }}
                    className={`w-full h-10 px-3 rounded-lg border text-sm focus:outline-none focus:ring-2 bg-white ${
                      fieldErrors.village
                        ? "border-red-300 focus:ring-red-200"
                        : "border-stone-200 focus:ring-emerald-800/30"
                    }`}
                  >
                    <option value="">— Choose village —</option>
                    {getVillages(sector, cell).map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <FieldError message={fieldErrors.village} />
                </div>
              )}

              {/* Landmark / extra notes — always optional */}
              <input
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="Landmark or extra directions (optional)"
                className="w-full h-10 px-3 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/30"
              />
            </div>
          )}
            {fulfillment === "pickup" && (
              <p className="text-xs text-stone-400">You'll collect your order directly from the shop.</p>
            )}
          </section>

          {/* Payment method */}
          <section className="bg-white rounded-2xl border border-stone-200 p-5">
            <h2 className="text-sm font-semibold text-stone-900 mb-3">Payment method</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("cash_on_delivery")}
                className={`flex items-center gap-2 justify-center h-11 rounded-xl border text-sm font-medium ${
                  paymentMethod === "cash_on_delivery"
                    ? "border-emerald-800 bg-emerald-50 text-emerald-900"
                    : "border-stone-200 text-stone-500"
                }`}
              >
                <Banknote className="w-4 h-4" /> Cash on delivery
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("momo")}
                className={`flex items-center gap-2 justify-center h-11 rounded-xl border text-sm font-medium ${
                  paymentMethod === "momo"
                    ? "border-emerald-800 bg-emerald-50 text-emerald-900"
                    : "border-stone-200 text-stone-500"
                }`}
              >
                <Wallet className="w-4 h-4" /> Mobile Money
              </button>
            </div>
            {paymentMethod === "momo" && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-stone-500 mb-1">
                  Pay <span className="font-semibold text-stone-900">{Number(subtotal).toLocaleString()} RWF</span> using
                  either option below, then place your order — we'll match the payment to your name and phone number.
                </p>

                <CopyableRow
                  label="MTN MoMo Pay code"
                  value={MOMO_PAYMENT_INFO.mtnMerchantCode}
                  hint={`Dial *182*8*1*${MOMO_PAYMENT_INFO.mtnMerchantCode}*${Math.round(subtotal)}#`}
                />
                <CopyableRow
                  label="MTN MoMo number"
                  value={MOMO_PAYMENT_INFO.mtnNumber}
                  hint={`Or send directly: *182*1*1*${MOMO_PAYMENT_INFO.mtnNumber}*${Math.round(subtotal)}#`}
                />
                {MOMO_PAYMENT_INFO.airtelNumber && (
                  <CopyableRow
                    label="Airtel Money number"
                    value={MOMO_PAYMENT_INFO.airtelNumber}
                    hint={`Dial *182*1*1*${MOMO_PAYMENT_INFO.airtelNumber}*${Math.round(subtotal)}#`}
                  />
                )}
              </div>
            )}
          </section>

          {/* Order summary */}
          <section className="bg-white rounded-2xl border border-stone-200 p-5">
            <h2 className="text-sm font-semibold text-stone-900 mb-3">Order summary</h2>
            <div className="space-y-1 mb-3">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm text-stone-600">
                  <span>{item.product_name} × {item.quantity}</span>
                  <span>{Number(item.subtotal).toLocaleString()} RWF</span>
                </div>
              ))}
            </div>
            <div className="border-t border-stone-100 pt-3 flex justify-between text-sm font-semibold text-stone-900">
              <span>Subtotal</span>
              <span>{Number(subtotal).toLocaleString()} RWF</span>
            </div>
          </section>

          <button
            type="submit"
            disabled={submitting || items.length === 0}
            className="w-full bg-emerald-900 text-white font-medium h-12 rounded-full hover:bg-emerald-800 disabled:opacity-50"
          >
            {submitting ? "Placing order..." : "Place order"}
          </button>
        </form>
      </div>
    </div>
  );
}
