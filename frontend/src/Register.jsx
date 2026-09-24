import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "./AuthContext";
import Header from "./Header";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Client-side rules, kept in sync with what the backend actually enforces
// (confirmed via its 400 response: first_name required, password >= 8 chars).
function validateField(field, values) {
  switch (field) {
    case "name":
      if (!values.name.trim()) return "Enter your full name.";
      if (values.name.trim().split(/\s+/).length < 2) return "Enter first and last name.";
      return null;
    case "phone":
      if (!values.phone.trim()) return "Enter your phone number.";
      if (!/^[0-9+][0-9\s-]{7,}$/.test(values.phone.trim())) return "Enter a valid phone number.";
      return null;
    case "email":
      if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
        return "Enter a valid email, or leave it blank.";
      }
      return null;
    case "password":
      if (!values.password) return "Enter a password.";
      if (values.password.length < 8) return "Must be at least 8 characters.";
      return null;
    default:
      return null;
  }
}

// The backend sends generic strings like "first_name is required." — map
// them back to the field that should show the error, so the person doesn't
// have to guess which box is wrong.
function mapServerErrorsToFields(errors) {
  const fieldErrors = {};
  const general = [];
  for (const msg of errors) {
    const lower = msg.toLowerCase();
    if (lower.includes("first_name") || lower.includes("last_name") || lower.includes("name")) {
      fieldErrors.name = msg;
    } else if (lower.includes("phone")) {
      fieldErrors.phone = msg;
    } else if (lower.includes("email")) {
      fieldErrors.email = msg;
    } else if (lower.includes("password")) {
      fieldErrors.password = msg;
    } else {
      general.push(msg);
    }
  }
  return { fieldErrors, general };
}

function FieldError({ message }) {
  if (!message) return null;
  return <p className="text-xs text-red-600 mt-1">{message}</p>;
}

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || null;

  const [values, setValues] = useState({ name: "", phone: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const setValue = (field) => (e) => {
    const next = { ...values, [field]: e.target.value };
    setValues(next);
    // Re-validate live once a field has been touched, so the error clears
    // the moment it's fixed instead of waiting for the next submit.
    if (touched[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: validateField(field, next) }));
    }
  };

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setFieldErrors((prev) => ({ ...prev, [field]: validateField(field, values) }));
  };

  const validateAll = () => {
    const errors = {};
    ["name", "phone", "email", "password"].forEach((field) => {
      const msg = validateField(field, values);
      if (msg) errors[field] = msg;
    });
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError(null);

    const errors = validateAll();
    setFieldErrors(errors);
    setTouched({ name: true, phone: true, email: true, password: true });
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const [firstName, ...rest] = values.name.trim().split(/\s+/);
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: rest.join(" ") || undefined,
          phone: values.phone.trim(),
          email: values.email.trim() || undefined,
          password: values.password,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (Array.isArray(body.errors) && body.errors.length > 0) {
          const { fieldErrors: mapped, general } = mapServerErrorsToFields(body.errors);
          setFieldErrors((prev) => ({ ...prev, ...mapped }));
          if (general.length > 0) setGeneralError(general.join(" "));
        } else {
          setGeneralError(body.message || "Registration failed.");
        }
        return;
      }

      const data = await res.json();
      login(data.token);
      navigate(redirectTo || "/");
    } catch (err) {
      setGeneralError(err.message);
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
      <div className="flex items-center justify-center px-5 pt-16">
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-1 text-center">Create account</h1>
        <p className="text-sm text-stone-400 text-center mb-6">Track orders and check out faster</p>

        <form onSubmit={handleSubmit} noValidate className="bg-white rounded-2xl border border-stone-200 p-6 space-y-3">
          {generalError && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg p-3">{generalError}</div>
          )}

          <div>
            <input
              value={values.name}
              onChange={setValue("name")}
              onBlur={handleBlur("name")}
              placeholder="Full name"
              className={inputClass("name")}
            />
            <FieldError message={fieldErrors.name} />
          </div>

          <div>
            <input
              value={values.phone}
              onChange={setValue("phone")}
              onBlur={handleBlur("phone")}
              placeholder="Phone number"
              className={inputClass("phone")}
            />
            <FieldError message={fieldErrors.phone} />
          </div>

          <div>
            <input
              type="email"
              value={values.email}
              onChange={setValue("email")}
              onBlur={handleBlur("email")}
              placeholder="Email (optional)"
              className={inputClass("email")}
            />
            <FieldError message={fieldErrors.email} />
          </div>

          <div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={values.password}
                onChange={setValue("password")}
                onBlur={handleBlur("password")}
                placeholder="Password"
                className={`${inputClass("password")} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.password ? (
              <FieldError message={fieldErrors.password} />
            ) : (
              <p className="text-xs text-stone-400 mt-1">At least 8 characters.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-900 text-white font-medium h-11 rounded-full hover:bg-emerald-800 disabled:opacity-50"
          >
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-stone-400 mt-4">
          Already have an account? <Link to="/login" className="text-emerald-800 font-medium">Sign in</Link>
        </p>
      </div>
      </div>
    </div>
  );
}
