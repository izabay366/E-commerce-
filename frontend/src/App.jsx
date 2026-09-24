import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import { CartProvider } from "./CartContext";
import { FavoritesProvider } from "./FavoritesContext";
import { NotificationsProvider } from "./NotificationsContext";
import MuhangaShopHome from "./MuhangaShopHome"; // the page we already built
import ProductListing from "./ProductListing"; // connected to real /api/products
import ProductDetail from "./ProductDetail";
import Cart from "./Cart";
import Checkout from "./Checkout";
import OrderConfirmation from "./OrderConfirmation";
import Login from "./Login"; // shared by customers (/login) and admins (/admin/login)
import Register from "./Register";
import Account from "./Account";
import DeliveryAreas from "./DeliveryAreas";
import ContactShop from "./ContactShop";
import MyOrders from "./MyOrders";
import Favorites from "./Favorites";
import FAQ from "./FAQ";
import TrackOrder from "./TrackOrder";
import AdminLayout from "./AdminLayout";
import AdminDashboard from "./AdminDashboard";
import AdminOrders from "./AdminOrders";
import AdminPayments from "./AdminPayments";
import AdminProducts from "./AdminProducts";
import AdminCategories from "./AdminCategories";
import AdminOffers from "./AdminOffers";
import AdminCustomers from "./AdminCustomers";
import AdminReports from "./AdminReports";
import CleaningServices from "./CleaningServices";
import CleaningServiceDetail from "./CleaningServiceDetail";
import MyCleaningRequests from "./MyCleaningRequests";
import AdminCleaning from "./AdminCleaning";
import AdminCleaners from "./AdminCleaners";
import AdminCleaningRequests from "./AdminCleaningRequests";

/* ============================================
   ROUTE GUARDS
   ============================================ */

// Blocks anyone whose JWT role isn't 'admin'.
// Not logged in -> /admin/login. Logged in but wrong role -> redirected to customer home.
function ProtectedAdminRoute() {
  const { isLoggedIn, role } = useAuth();

  if (!isLoggedIn) return <Navigate to="/admin/login" replace />;
  if (role?.toLowerCase() !== "admin") return <Navigate to="/" replace />;

  return <Outlet />;
}

/* ============================================
   PLACEHOLDER PAGES
   Replace each of these with the real page component
   as we build it.
   ============================================ */


/* ============================================
   APP ROUTER
   ============================================ */

export default function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <CartProvider>
          <FavoritesProvider>
          <BrowserRouter>
            <Routes>
              {/* Customer side (public) — home doubles as the landing page. Guest checkout is still the default. */}
              <Route path="/" element={<MuhangaShopHome />} />
              <Route path="/products" element={<ProductListing />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/orders/:orderId/confirmation" element={<OrderConfirmation />} />

              {/* Optional customer accounts — same Login component admins use, role decides where it redirects */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/account" element={<Account />} />
              <Route path="/delivery-areas" element={<DeliveryAreas />} />
              <Route path="/contact" element={<ContactShop />} />
              <Route path="/orders" element={<MyOrders />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/track" element={<TrackOrder />} />

              {/* Cleaning Services */}
              <Route path="/cleaning" element={<CleaningServices />} />
              <Route path="/cleaning/requests" element={<MyCleaningRequests />} />
              <Route path="/cleaning/:id" element={<CleaningServiceDetail />} />

              {/* Admin login — same screen, reachable at this path too */}
              <Route path="/admin/login" element={<Login />} />

              {/* Admin side — everything under /admin requires role === 'admin', and shares the sidebar layout */}
              <Route path="/admin" element={<ProtectedAdminRoute />}>
                <Route element={<AdminLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="products" element={<AdminProducts />} />
                  <Route path="categories" element={<AdminCategories />} />
                  <Route path="offers" element={<AdminOffers />} />
                  <Route path="orders" element={<AdminOrders />} />
                  <Route path="payments" element={<AdminPayments />} />
                  <Route path="customers" element={<AdminCustomers />} />
                  <Route path="reports" element={<AdminReports />} />
                  <Route path="cleaning" element={<AdminCleaning />} />
                  <Route path="cleaners" element={<AdminCleaners />} />
                  <Route path="cleaning-requests" element={<AdminCleaningRequests />} />
                </Route>
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          </FavoritesProvider>
        </CartProvider>
      </NotificationsProvider>
    </AuthProvider>
  );
}
