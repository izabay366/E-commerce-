import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, ListOrdered, Tags, Percent, Users, CreditCard, FileBarChart, Sparkles, ClipboardList, LogOut, ExternalLink } from "lucide-react";
import { useAuth } from "./AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const POLL_INTERVAL_MS = 30000;

const NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/products",  label: "Products",  icon: Package },
  { to: "/admin/orders",    label: "Orders",    icon: ListOrdered, showPendingBadge: true },
  { to: "/admin/payments",  label: "Payments",  icon: CreditCard },
  { to: "/admin/categories",label: "Categories",icon: Tags },
  { to: "/admin/offers",    label: "Offers",    icon: Percent },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/reports",   label: "Reports",   icon: FileBarChart },
  { to: "/admin/cleaning",          label: "Cleaning",          icon: Sparkles },
  { to: "/admin/cleaners",          label: "Cleaners",          icon: Users },
  { to: "/admin/cleaning-requests", label: "Cleaning Requests", icon: ClipboardList },
];

export default function AdminLayout() {
  const { logout, token } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!token) return;

    const checkPending = () => {
      fetch(`${API_URL}/api/orders?status=PENDING`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setPendingCount(data.count || 0);
        })
        .catch(() => {});
    };

    checkPending();
    const interval = setInterval(checkPending, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token]);

  return (
    <div className="min-h-screen bg-stone-50 font-sans flex">
      <aside className="w-56 shrink-0 bg-emerald-950 border-r border-emerald-900 min-h-screen flex flex-col">
        <div className="px-5 h-16 flex items-center border-b border-emerald-900">
          <span className="font-serif text-lg font-semibold text-white">
            AMI<span className="text-amber-400">SERVICES</span>
          </span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, showPendingBadge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 text-sm font-medium px-3 h-10 rounded-lg ${
                  isActive
                    ? "bg-emerald-800 text-white"
                    : "text-emerald-200 hover:bg-emerald-900 hover:text-white"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span className="flex-1">{label}</span>
              {showPendingBadge && pendingCount > 0 && (
                <span className="bg-amber-500 text-emerald-950 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-emerald-900 space-y-1">
          <a
            href="/"
            className="flex items-center gap-2.5 text-sm text-emerald-200 hover:text-white px-3 h-10 rounded-lg hover:bg-emerald-900"
          >
            <ExternalLink className="w-4 h-4" /> View shop
          </a>
          <button
            onClick={() => {
              logout();
              navigate("/admin/login");
            }}
            className="w-full flex items-center gap-2.5 text-sm text-emerald-200 hover:text-red-300 px-3 h-10 rounded-lg hover:bg-emerald-900"
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
