import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import Header from "./Header";

const FAQS = [
  {
    q: "What areas do you deliver to?",
    a: "We deliver across Muhanga District, by Sector and Cell. Enter your Sector and Cell at checkout and we'll get it to you.",
  },
  {
    q: "How do I pay?",
    a: "Cash on delivery, or Mobile Money (MTN MoMo Pay or a direct MTN number — both shown at checkout with the exact amount pre-filled).",
  },
  {
    q: "Can I track my order?",
    a: "Yes, if you're signed in. Go to Account → My orders, or use the \"Track an order\" page to check a specific order's status. Guest checkouts (no account) currently can't be tracked online — call the shop directly for a status update.",
  },
  {
    q: "Do I need an account to order?",
    a: "No — guest checkout is the default and fastest option. Creating an account just means you don't have to retype your details next time, and lets you see your order history and status in one place.",
  },
  {
    q: "What if an item is out of stock?",
    a: "Out-of-stock items are marked on the product page. If something runs out after you've ordered, the shop will contact you using the phone number on your order.",
  },
  {
    q: "How do I change or cancel an order?",
    a: "Contact the shop directly with your order details as soon as possible — orders that have already started delivery preparation may not be changeable.",
  },
];

function FAQItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-stone-200 py-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-sm font-medium text-stone-900">{item.q}</span>
        <ChevronDown className={`w-4 h-4 text-stone-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="text-sm text-stone-500 mt-2 leading-relaxed">{item.a}</p>}
    </div>
  );
}

export default function FAQ() {
  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <Header />
      <div className="max-w-2xl mx-auto px-5 pt-8 pb-24">
        <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-1">Frequently asked questions</h1>
        <p className="text-sm text-stone-400 mb-6">Common questions about ordering, delivery, and payment.</p>
        <div className="bg-white rounded-2xl border border-stone-200 px-5">
          {FAQS.map((item, i) => (
            <FAQItem key={i} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
