import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, ListOrdered, Tags, Percent, Users,
  CreditCard, FileBarChart, Sparkles, ClipboardList, LogOut,
  ExternalLink, Menu, X,
} from "lucide-react";
import { useAuth } from "./AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const POLL_INTERVAL_MS = 30000;

const NAV_ITEMS = [
  { to: "/admin/dashboard",          label: "Dashboard",          icon: LayoutDashboard },
  { to: "/admin/products",           label: "Products",           icon: Package },
  { to: "/admin/orders",             label: "Orders",             icon: ListOrdered, showPendingBadge: true },
  { to: "/admin/payments",           label: "Payments",           icon: CreditCard },
  { to: "/admin/categories",         label: "Categories",         icon: Tags },
  { to: "/admin/offers",             label: "Offers",             icon: Percent },
  { to: "/admin/customers",          label: "Customers",          icon: Users },
  { to: "/admin/reports",            label: "Reports",            icon: FileBarChart },
  { to: "/admin/cleaning",           label: "Cleaning",           icon: Sparkles },
  { to: "/admin/cleaners",           label: "Cleaners",           icon: Users },
  { to: "/admin/cleaning-requests",  label: "Cleaning Requests",  icon: ClipboardList },
];

export default function AdminLayout() {
  const { logout, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar whenever route changes (mobile nav tap)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

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

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className="px-5 h-16 flex items-center justify-between border-b border-emerald-900">
        <span className="font-serif text-lg font-semibold text-white">
          AMI<span className="text-amber-400">SERVICES</span>
        </span>
        {/* Close button — mobile only */}
        <button
          className="lg:hidden text-emerald-300 hover:text-white"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {showPendingBadge && pendingCount > 0 && (
              <span className="bg-amber-500 text-emerald-950 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom actions */}
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
    </>
  );

  return (
    <div className="min-h-screen bg-stone-50 font-sans flex">
      {/* ── Desktop sidebar (always visible ≥ lg) ── */}
      <aside className="hidden lg:flex w-56 shrink-0 bg-emerald-950 border-r border-emerald-900 min-h-screen flex-col">
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar (drawer) ── */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-emerald-950 border-r border-emerald-900 flex flex-col lg:hidden">
            <SidebarContent />
          </aside>
        </>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 h-14 bg-emerald-950 border-b border-emerald-900 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-emerald-200 hover:text-white"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-serif text-base font-semibold text-white">
            AMI<span className="text-amber-400">SERVICES</span>
          </span>
          {pendingCount > 0 && (
            <span className="ml-auto bg-amber-500 text-emerald-950 text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
              {pendingCount} pending
            </span>
          )}
        </div>

        <Outlet />
      </div>
    </div>
  );
}
