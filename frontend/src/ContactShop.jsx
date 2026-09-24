import React, { useState } from "react";
import { Phone, MapPin, Copy, Check } from "lucide-react";
import Header from "./Header";

const SHOP_PHONE = "07901722383";

export default function ContactShop() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SHOP_PHONE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can fail silently — the number is still visible to copy manually.
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <Header />
      <div className="max-w-2xl mx-auto px-5 pt-8 pb-24">
        <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-1">Contact the shop</h1>
        <p className="text-sm text-stone-400 mb-6">Questions about an order or delivery? Reach out directly.</p>

        <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5 text-emerald-800" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-900">{SHOP_PHONE}</p>
              <p className="text-xs text-stone-400">Call or WhatsApp</p>
            </div>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs font-medium text-emerald-800 border border-emerald-200 rounded-full px-3 h-8 hover:bg-emerald-50"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-5 flex items-start gap-3">
          <MapPin className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-stone-900 mb-1">Muhanga District, Rwanda</p>
            <p className="text-sm text-stone-500">
              For questions about an existing order, please have your order number ready when you call.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
