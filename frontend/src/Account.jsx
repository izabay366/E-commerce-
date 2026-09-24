import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { useAuth } from "./AuthContext";
import Header from "./Header";


// Namespaced per-account (by user id) — a single shared key would let one
// person's saved address leak into a different account's Account page on
// the same browser, which is exactly the bug this fixes.
function rememberedDetailsKey(userId) {
  return `muhangashop_checkout_details:${userId || "guest"}`;
}

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
    // Best-effort only.
  }
}

export default function Account() {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    sector: "",
    cell: "",
    landmark: "",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/login", { state: { from: "/account" } });
      return;
    }
    const remembered = loadRememberedDetails(user?.userId);
    setForm({
      name: nameFromUser(user) || remembered?.name || "",
      phone: phoneFromUser(user) || remembered?.phone || "",
      email: user?.email || "",
      sector: remembered?.sector || "",
      cell: remembered?.cell || "",
      landmark: remembered?.landmark || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  const setField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setSaved(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    // Saved locally right away so this page is useful today.
    // TODO: once the backend profile endpoint is confirmed, PUT the same
    // fields there too so the address follows the account across devices,
    // not just this browser.
    saveRememberedDetails(user?.userId, {
      name: form.name.trim(),
      phone: form.phone.trim(),
      sector: form.sector.trim(),
      cell: form.cell.trim(),
      landmark: form.landmark.trim(),
    });
    setSaved(true);
  };

  if (!isLoggedIn) return null;

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <Header />
      <div className="max-w-xl mx-auto px-5 pt-8 pb-24">
        <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-1">Account</h1>
        <p className="text-sm text-stone-400 mb-6">
          Your details and delivery location — saved so checkout doesn't ask twice.
        </p>

        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3 mb-5">
          These details are saved to your account, but only within this browser for now. Once the
          account syncs with the server, they'll follow you across devices too.
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <section className="bg-white rounded-2xl border border-stone-200 p-5">
            <h2 className="text-sm font-semibold text-stone-900 mb-3">Your details</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-stone-400 mb-1 block">Full name</label>
                <input
                  value={form.name}
                  onChange={setField("name")}
                  className="w-full h-10 px-3 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/30"
                />
              </div>
              <div>
                <label className="text-xs text-stone-400 mb-1 block">Phone number</label>
                <input
                  value={form.phone}
                  onChange={setField("phone")}
                  className="w-full h-10 px-3 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/30"
                />
              </div>
              <div>
                <label className="text-xs text-stone-400 mb-1 block">Email</label>
                <input
                  type="email"
                  value={form.email}
                  disabled
                  className="w-full h-10 px-3 rounded-lg border border-stone-200 bg-stone-50 text-sm text-stone-400"
                />
                <p className="text-xs text-stone-400 mt-1">Email changes need a verification step — not built yet.</p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-stone-200 p-5">
            <h2 className="text-sm font-semibold text-stone-900 mb-3">Saved delivery location</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-stone-400 mb-1 block">Sector</label>
                <input
                  value={form.sector}
                  onChange={setField("sector")}
                  className="w-full h-10 px-3 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/30"
                />
              </div>
              <div>
                <label className="text-xs text-stone-400 mb-1 block">Cell</label>
                <input
                  value={form.cell}
                  onChange={setField("cell")}
                  className="w-full h-10 px-3 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/30"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-stone-400 mb-1 block">Landmark (optional)</label>
              <input
                value={form.landmark}
                onChange={setField("landmark")}
                className="w-full h-10 px-3 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/30"
              />
            </div>
          </section>

          <button
            type="submit"
            className="w-full bg-emerald-900 text-white font-medium h-11 rounded-full hover:bg-emerald-800 flex items-center justify-center gap-2"
          >
            {saved ? <><Check className="w-4 h-4" /> Saved</> : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
