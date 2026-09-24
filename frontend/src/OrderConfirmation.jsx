import React from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { CheckCircle2, Package, Truck, Store } from "lucide-react";
import { useAuth } from "./AuthContext";
import Header from "./Header";
import { STATUS_LABEL } from "./orderStatus";

// The order is sent straight from Checkout.jsx via navigation state — the
// backend's single-order lookup requires being logged in, which would break
// this page for every guest checkout (the default, most common path). If
// the state is missing (e.g. someone refreshes this page directly), there's
// no reliable way to re-fetch it for a guest, so this shows a clear
// fallback instead of a blank or broken page.
export default function OrderConfirmation() {
  const { orderId } = useParams();
  const location = useLocation();
  const { isLoggedIn } = useAuth();
  const order = location.state?.order;

  if (!order) {
    return (
      <div className="min-h-screen bg-stone-50 font-sans">
        <Header />
        <div className="max-w-lg mx-auto px-5 pt-16 pb-24 text-center">
          <Package className="w-10 h-10 text-stone-300 mx-auto mb-4" />
          <h1 className="font-serif text-xl font-semibold text-stone-900 mb-2">
            Order placed — details not shown here
          </h1>
          <p className="text-sm text-stone-500 mb-6">
            Your order (#{String(orderId).slice(0, 8)}) went through, but this page only shows details
            right after checkout. {isLoggedIn
              ? "You can find it in your order history below."
              : "Since you checked out as a guest, sign in or contact the shop to check its status."}
          </p>
          <div className="flex items-center justify-center gap-3">
            {isLoggedIn && (
              <Link to="/orders" className="bg-emerald-900 text-white text-sm font-medium px-5 h-10 leading-10 rounded-full hover:bg-emerald-800">
                My orders
              </Link>
            )}
            <Link to="/products" className="text-emerald-900 text-sm font-medium underline underline-offset-4">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const items = order.items || [];
  const isDelivery = order.fulfillment_type === "DELIVERY";
  const address = order.address || order.delivery?.address;
  const paymentMethod = order.payment_method || order.payment?.method;

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <Header />
      <div className="max-w-lg mx-auto px-5 pt-12 pb-24">
        <div className="text-center mb-6">
          <CheckCircle2 className="w-12 h-12 text-emerald-700 mx-auto mb-3" />
          <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-1">Order placed!</h1>
          <p className="text-sm text-stone-500">
            Order #{String(order.id).slice(0, 8)} · {STATUS_LABEL[order.status] || order.status}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            {isDelivery ? <Truck className="w-4 h-4 text-emerald-800" /> : <Store className="w-4 h-4 text-emerald-800" />}
            <p className="text-sm font-semibold text-stone-900">
              {isDelivery ? "Delivery" : "Shop pickup"}
            </p>
          </div>
          {isDelivery && address && <p className="text-sm text-stone-500 mb-1">{address}</p>}
          <p className="text-sm text-stone-500">
            {order.customer_name} · {order.customer_phone}
          </p>
          {paymentMethod && (
            <p className="text-xs text-stone-400 mt-2">
              Paying by {paymentMethod === "MOBILE_MONEY" ? "Mobile Money" : "Cash on delivery"}
            </p>
          )}
        </div>

        {items.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-4">
            <p className="text-sm font-semibold text-stone-900 mb-3">Items</p>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={item.id || i} className="flex justify-between text-sm text-stone-600">
                  <span>
                    {item.product_name || item.name} × {item.quantity}
                  </span>
                  <span>{Number(item.subtotal ?? item.unit_price * item.quantity).toLocaleString()} RWF</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {order.total_amount != null && (
          <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-6 flex justify-between">
            <span className="text-sm font-semibold text-stone-900">Total</span>
            <span className="text-sm font-semibold text-stone-900">
              {Number(order.total_amount).toLocaleString()} RWF
            </span>
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          {isLoggedIn && (
            <Link to="/orders" className="bg-emerald-900 text-white text-sm font-medium px-5 h-10 leading-10 rounded-full hover:bg-emerald-800">
              View my orders
            </Link>
          )}
          <Link to="/products" className="text-emerald-900 text-sm font-medium underline underline-offset-4">
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
