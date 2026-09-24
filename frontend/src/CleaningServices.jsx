import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Clock, ChevronRight, AlertCircle } from "lucide-react";
import Header from "./Header";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function CleaningServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/cleaning-services`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((data) => setServices(data.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <Header />
      <div className="max-w-2xl mx-auto px-5 pt-8 pb-24">
        {/* Hero */}
        <div className="bg-emerald-900 rounded-2xl p-8 mb-8 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-medium text-emerald-300">Professional Cleaning</span>
          </div>
          <h1 className="font-serif text-3xl font-semibold mb-2">
            Book a Cleaning
          </h1>
          <p className="text-emerald-200 text-sm leading-relaxed">
            Professional cleaning services delivered to your home or business in Muhanga.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 mb-6">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Services list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-stone-100 p-6 animate-pulse">
                <div className="h-4 bg-stone-100 rounded w-1/2 mb-2" />
                <div className="h-3 bg-stone-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-200">
            <Sparkles className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 text-sm">No cleaning services available at the moment.</p>
            <p className="text-stone-400 text-xs mt-1">Please check back soon.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((svc) => (
              <Link
                key={svc.id}
                to={`/cleaning/${svc.id}`}
                className="block bg-white rounded-2xl border border-stone-200 p-6 hover:border-emerald-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-stone-900 group-hover:text-emerald-900 mb-1">
                      {svc.name}
                    </p>
                    {svc.description && (
                      <p className="text-sm text-stone-500 mb-3 line-clamp-2">
                        {svc.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-stone-400">
                      {svc.base_price !== null && (
                        <span className="font-semibold text-emerald-800">
                          {Number(svc.base_price).toLocaleString()} RWF
                        </span>
                      )}
                      {svc.estimated_duration && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {svc.estimated_duration}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-emerald-600 shrink-0 mt-1" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* My Requests link */}
        <div className="mt-8 text-center">
          <Link
            to="/cleaning/requests"
            className="text-sm text-emerald-800 hover:text-emerald-900 underline underline-offset-2"
          >
            View my cleaning requests →
          </Link>
        </div>
      </div>
    </div>
  );
}
