import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Sparkles, Clock, ChevronLeft,
  MapPin, AlertCircle, CheckCircle,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import Header from "./Header";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function Field({ label, id, type = "text", value, onChange, required, placeholder, helpText }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-stone-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-800/25 focus:border-emerald-800"
      />
      {helpText && <p className="text-xs text-stone-400 mt-1">{helpText}</p>}
    </div>
  );
}

export default function CleaningServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn, token } = useAuth();

  const [service, setService] = useState(null);
  const [loadingService, setLoadingService] = useState(true);
  const [serviceError, setServiceError] = useState(null);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [location, setLocation] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [notes, setNotes] = useState("");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [createdRequest, setCreatedRequest] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/cleaning-services/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Service not found (${res.status})`);
        return res.json();
      })
      .then((data) => setService(data.data))
      .catch((err) => setServiceError(err.message))
      .finally(() => setLoadingService(false));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isLoggedIn) {
      navigate("/login");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`${API_URL}/api/cleaning-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer_name:  customerName,
          customer_phone: customerPhone,
          service_id:     id,
          location,
          preferred_date: preferredDate || undefined,
          preferred_time: preferredTime || undefined,
          notes:          notes || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.errors?.join(", ") || data?.message || "Booking failed.";
        throw new Error(msg);
      }

      setCreatedRequest(data.data);
      setSuccess(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / error state ─────────────────────────────────────────────────
  if (loadingService) {
    return (
      <div className="min-h-screen bg-stone-50 font-sans">
        <Header />
        <div className="max-w-2xl mx-auto px-5 pt-8">
          <div className="bg-white rounded-2xl border border-stone-100 p-8 animate-pulse">
            <div className="h-6 bg-stone-100 rounded w-1/2 mb-3" />
            <div className="h-4 bg-stone-100 rounded w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (serviceError || !service) {
    return (
      <div className="min-h-screen bg-stone-50 font-sans">
        <Header />
        <div className="max-w-2xl mx-auto px-5 pt-8">
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-200">
            <AlertCircle className="w-10 h-10 text-red-300 mx-auto mb-3" />
            <p className="text-stone-600 text-sm mb-4">{serviceError || "Service not found."}</p>
            <Link
              to="/cleaning"
              className="inline-flex items-center gap-1.5 text-sm text-emerald-800 hover:text-emerald-900"
            >
              <ChevronLeft className="w-4 h-4" /> Back to services
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (success && createdRequest) {
    return (
      <div className="min-h-screen bg-stone-50 font-sans">
        <Header />
        <div className="max-w-2xl mx-auto px-5 pt-8 pb-24">
          <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-emerald-700" />
            </div>
            <h2 className="font-serif text-2xl font-semibold text-stone-900 mb-2">
              Booking Confirmed!
            </h2>
            <p className="text-stone-500 text-sm mb-6">
              Your cleaning request has been submitted. We'll confirm and assign a cleaner shortly.
            </p>

            <div className="bg-stone-50 rounded-xl p-4 text-left text-sm space-y-2 mb-8">
              <div className="flex justify-between">
                <span className="text-stone-500">Service</span>
                <span className="font-medium text-stone-900">{service.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Status</span>
                <span className="text-amber-700 font-medium">Pending confirmation</span>
              </div>
              {createdRequest.preferred_date && (
                <div className="flex justify-between">
                  <span className="text-stone-500">Date</span>
                  <span className="font-medium text-stone-900">{createdRequest.preferred_date}</span>
                </div>
              )}
              {createdRequest.price !== null && (
                <div className="flex justify-between">
                  <span className="text-stone-500">Price</span>
                  <span className="font-semibold text-emerald-800">
                    {Number(createdRequest.price).toLocaleString()} RWF
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/cleaning/requests"
                className="inline-flex items-center justify-center gap-2 bg-emerald-900 text-white text-sm font-medium px-6 h-10 rounded-full hover:bg-emerald-800"
              >
                View my requests
              </Link>
              <Link
                to="/cleaning"
                className="inline-flex items-center justify-center gap-2 border border-stone-200 text-stone-700 text-sm font-medium px-6 h-10 rounded-full hover:bg-stone-50"
              >
                Book another service
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main: service detail + booking form ──────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <Header />
      <div className="max-w-2xl mx-auto px-5 pt-8 pb-24">
        {/* Back link */}
        <Link
          to="/cleaning"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-emerald-900 mb-6"
        >
          <ChevronLeft className="w-4 h-4" /> All services
        </Link>

        {/* Service card */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-semibold text-stone-900 leading-tight">
                {service.name}
              </h1>
              {service.estimated_duration && (
                <p className="text-sm text-stone-400 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5" /> {service.estimated_duration}
                </p>
              )}
            </div>
          </div>

          {service.description && (
            <p className="text-sm text-stone-600 leading-relaxed mb-4">{service.description}</p>
          )}

          {service.base_price !== null && (
            <div className="bg-emerald-50 rounded-xl px-4 py-3">
              <p className="text-xs text-emerald-700 mb-0.5">Starting price</p>
              <p className="text-2xl font-bold text-emerald-900">
                {Number(service.base_price).toLocaleString()}{" "}
                <span className="text-sm font-normal text-emerald-700">RWF</span>
              </p>
            </div>
          )}
        </div>

        {/* Booking form */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <h2 className="font-serif text-lg font-semibold text-stone-900 mb-5">Book this service</h2>

          {!isLoggedIn && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-5 text-sm text-amber-800">
              Please{" "}
              <Link to="/login" className="font-medium underline">
                sign in
              </Link>{" "}
              to submit a booking request.
            </div>
          )}

          {submitError && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 mb-5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                id="customer_name"
                label="Your Name"
                value={customerName}
                onChange={setCustomerName}
                required
                placeholder="Jean-Paul Habimana"
              />
              <Field
                id="customer_phone"
                label="Phone Number"
                value={customerPhone}
                onChange={setCustomerPhone}
                required
                placeholder="+250788123456"
              />
            </div>

            <div className="relative">
              <label htmlFor="location" className="block text-sm font-medium text-stone-700 mb-1.5">
                Location <span className="text-red-500">*</span>
              </label>
              <MapPin className="w-4 h-4 text-stone-400 absolute left-3 top-[38px]" />
              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                placeholder="Street / neighborhood in Muhanga"
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-800/25 focus:border-emerald-800"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                id="preferred_date"
                label="Preferred Date"
                type="date"
                value={preferredDate}
                onChange={setPreferredDate}
                helpText="Optional — we'll contact you to confirm"
              />
              <Field
                id="preferred_time"
                label="Preferred Time"
                type="time"
                value={preferredTime}
                onChange={setPreferredTime}
                helpText="Optional"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-stone-700 mb-1.5">
                Additional Notes
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any specific instructions or areas to focus on..."
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-800/25 focus:border-emerald-800 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !isLoggedIn}
              className="w-full h-11 bg-emerald-900 text-white text-sm font-semibold rounded-full hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Submitting..." : "Request Cleaning Service"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
