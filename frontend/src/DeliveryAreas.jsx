import React from "react";
import { MapPin, Bike, Truck } from "lucide-react";
import Header from "./Header";

export default function DeliveryAreas() {
  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <Header />
      <div className="max-w-2xl mx-auto px-5 pt-8 pb-24">
        <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-1">Delivery areas</h1>
        <p className="text-sm text-stone-400 mb-6">Where AmiServices delivers, and how</p>

        <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-emerald-800" />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-900 mb-1">Most of Muhanga District</p>
            <p className="text-sm text-stone-500">
              Standard delivery covers most Sectors and Cells across Muhanga — enter your Sector
              and Cell at checkout and we'll get it to you.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-6 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
            <Bike className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-900 mb-1">Farther areas — bike/moto delivery</p>
            <p className="text-sm text-stone-500">
              Some areas that are farther out, like <span className="font-medium text-stone-700">Nyamabuye Sector</span>,
              are delivered by bike or moto rather than standard delivery. This may take a little longer —
              we'll confirm your order and delivery time by phone before it goes out.
            </p>
          </div>
        </div>

        <div className="bg-stone-100 rounded-2xl p-5 flex items-start gap-3">
          <MapPin className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
          <p className="text-sm text-stone-500">
            Not sure if we deliver to your area? Enter your Sector and Cell at checkout, or place a Cash on Delivery
            order — we'll call to confirm delivery details before preparing it.
          </p>
        </div>
      </div>
    </div>
  );
}
