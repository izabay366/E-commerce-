import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Bell, ShoppingBag, User, Package, Menu, X } from "lucide-react";
import { useCart } from "./CartContext";
import { useAuth } from "./AuthContext";
import { useNotifications } from "./NotificationsContext";
import { STATUS_LABEL } from "./orderStatus";

function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Live only for regular customers — admin already has its own live
// pending-orders badge in the AdminLayout sidebar, so this stays a plain
// icon for admin and for guests to avoid two different notification
// systems fighting for attention in the same header.
function NotificationsBell({ active }) {
  const { notifications, unreadCount, clearNotifications } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!active) {
    return <Bell className="w-5 h-5 text-stone-500" />;
  }

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={() => setOpen((v) => !v)} className="relative">
        <Bell className="w-5 h-5 text-stone-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-[10px] font-bold text-emerald-950 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-72 bg-white rounded-xl border border-stone-200 shadow-lg z-20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
            <p className="text-sm font-semibold text-stone-900">Order updates</p>
            {notifications.length > 0 && (
              <button onClick={clearNotifications} className="text-xs text-stone-400 hover:text-stone-600">
                Clear
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-xs text-stone-400 text-center py-8 px-4">
              No updates yet — you'll see it here when one of your orders changes status.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {notifications.map((n, i) => (
                <Link
                  key={`${n.orderId}-${n.at}-${i}`}
                  to="/track"
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-2.5 px-4 py-3 border-b border-stone-50 last:border-0 hover:bg-stone-50"
                >
                  <Package className="w-4 h-4 text-emerald-800 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-stone-900">
                      Order #{String(n.orderId).slice(0, 8)} is now{" "}
                      <span className="font-medium">{STATUS_LABEL[n.status] || n.status}</span>
                    </p>
                    <p className="text-[11px] text-stone-400 mt-0.5">{timeAgo(n.at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const { itemCount } = useCart();
  const { isLoggedIn, role, logout } = useAuth();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const isAdmin = isLoggedIn && role?.toLowerCase() === "admin";

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchValue.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchValue.trim())}`);
      setMobileSearchOpen(false);
      setMobileMenuOpen(false);
    }
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center gap-3 sm:gap-6">
          {/* Logo */}
          <Link
            to="/"
            className="font-serif text-lg sm:text-xl font-semibold text-emerald-900 tracking-tight shrink-0"
            onClick={closeMobileMenu}
          >
            AMI<span className="text-amber-500">SERVICES</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-5 text-sm text-stone-600 shrink-0">
            <Link to="/" className="hover:text-emerald-900">Home</Link>
            <Link to="/products" className="hover:text-emerald-900">Categories</Link>
            <Link to="/cleaning" className="hover:text-emerald-900">Cleaning</Link>
          </nav>

          {/* Desktop search bar */}
          <form onSubmit={handleSearchSubmit} className="hidden sm:flex flex-1 relative max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search rice, milk, chicken..."
              className="w-full h-10 pl-9 pr-3 rounded-full bg-stone-100 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-800/30"
            />
          </form>

          {/* Right icons */}
          <div className="flex items-center gap-2.5 sm:gap-3 ml-auto shrink-0">
            {/* Mobile search toggle */}
            <button
              className="sm:hidden p-1.5 text-stone-500"
              onClick={() => setMobileSearchOpen((v) => !v)}
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Notifications bell */}
            <NotificationsBell active={isLoggedIn && !isAdmin} />

            {/* Desktop account links */}
            {isAdmin ? (
              <Link
                to="/admin/dashboard"
                className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:text-emerald-900"
              >
                <User className="w-4 h-4" /> Admin
              </Link>
            ) : isLoggedIn ? (
              <div className="hidden sm:flex items-center gap-4">
                <Link to="/account" className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-emerald-900">
                  <User className="w-4 h-4" /> Account
                </Link>
                <button
                  onClick={() => { logout(); navigate("/"); }}
                  className="text-sm text-stone-400 hover:text-red-500"
                >
                  Log out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden sm:flex items-center gap-1.5 text-sm text-stone-500 hover:text-emerald-900"
              >
                <User className="w-4 h-4" /> Sign in
              </Link>
            )}

            {/* Cart */}
            <Link to="/cart" className="relative">
              <ShoppingBag className="w-5 h-5 text-stone-700" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-amber-500 text-[10px] font-bold text-emerald-950 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-1.5 text-stone-500"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile search bar (slides in below header) */}
        {mobileSearchOpen && (
          <div className="sm:hidden px-4 pb-3 border-b border-stone-100">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                autoFocus
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search rice, milk, chicken..."
                className="w-full h-10 pl-9 pr-3 rounded-full bg-stone-100 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-800/30"
              />
            </form>
          </div>
        )}
      </header>

      {/* Mobile slide-down nav drawer */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-20 bg-black/20"
            onClick={closeMobileMenu}
          />
          {/* Drawer */}
          <div className="fixed top-14 left-0 right-0 z-20 bg-white border-b border-stone-200 shadow-lg md:hidden">
            <nav className="px-4 py-3 space-y-1">
              <Link
                to="/"
                onClick={closeMobileMenu}
                className="flex items-center h-11 px-3 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-emerald-900"
              >
                Home
              </Link>
              <Link
                to="/products"
                onClick={closeMobileMenu}
                className="flex items-center h-11 px-3 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-emerald-900"
              >
                Categories
              </Link>
              <Link
                to="/cleaning"
                onClick={closeMobileMenu}
                className="flex items-center h-11 px-3 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-emerald-900"
              >
                Cleaning
              </Link>

              <div className="border-t border-stone-100 pt-2 mt-2">
                {isAdmin ? (
                  <Link
                    to="/admin/dashboard"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-2 h-11 px-3 rounded-xl text-sm font-medium text-emerald-800 hover:bg-emerald-50"
                  >
                    <User className="w-4 h-4" /> Admin dashboard
                  </Link>
                ) : isLoggedIn ? (
                  <>
                    <Link
                      to="/account"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-2 h-11 px-3 rounded-xl text-sm text-stone-600 hover:bg-stone-50"
                    >
                      <User className="w-4 h-4" /> Account
                    </Link>
                    <Link
                      to="/orders"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-2 h-11 px-3 rounded-xl text-sm text-stone-600 hover:bg-stone-50"
                    >
                      <Package className="w-4 h-4" /> My orders
                    </Link>
                    <button
                      onClick={() => { logout(); navigate("/"); closeMobileMenu(); }}
                      className="w-full flex items-center gap-2 h-11 px-3 rounded-xl text-sm text-red-500 hover:bg-red-50"
                    >
                      Log out
                    </button>
                  </>
                ) : (
                  <Link
                    to="/login"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-2 h-11 px-3 rounded-xl text-sm text-stone-600 hover:bg-stone-50"
                  >
                    <User className="w-4 h-4" /> Sign in
                  </Link>
                )}
              </div>
            </nav>
          </div>
        </>
      )}
    </>
  );
}
