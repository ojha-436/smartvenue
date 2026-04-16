/**
 * OrderPage - Food ordering interface
 * Display menu grouped by category, manage cart, and place orders
 */

import React, { useMemo, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ShoppingCart, Plus, Minus, Check, Clock } from 'lucide-react';
import { useApi } from '../shared/hooks/useApi';

/**
 * OrderPage component - Food ordering system
 */
export default function OrderPage({ user, venueId }) {
  const [cart, setCart] = useState({});
  const [placing, setPlacing] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);

  // Fetch menu from API
  const { data: menu = [], loading } = useApi(`/api/menu/${venueId}`, {
    client: 'order',
  });

  // API hook for placing orders
  const { execute: executePlaceOrder } = useApi(null, {
    method: 'POST',
    client: 'order',
  });

  /**
   * Add item to cart
   */
  const add = useCallback((itemId) => {
    setCart((c) => ({ ...c, [itemId]: (c[itemId] || 0) + 1 }));
  }, []);

  /**
   * Remove or decrease item quantity in cart
   */
  const sub = useCallback((itemId) => {
    setCart((c) => {
      const n = (c[itemId] || 0) - 1;
      if (n <= 0) {
        const nc = { ...c };
        delete nc[itemId];
        return nc;
      }
      return { ...c, [itemId]: n };
    });
  }, []);

  /**
   * Get cart items and total, memoized
   */
  const { cartItems, total } = useMemo(() => {
    const items = (menu || []).filter((m) => cart[m.id]);
    const cartTotal = items.reduce((s, m) => s + m.price * cart[m.id], 0);
    return { cartItems: items, total: cartTotal };
  }, [menu, cart]);

  /**
   * Place order
   */
  const placeOrder = useCallback(async () => {
    if (!cartItems.length) {
      toast('Add something to your cart first!');
      return;
    }
    setPlacing(true);
    try {
      const items = cartItems.map((m) => ({
        itemId: m.id,
        name: m.name,
        quantity: cart[m.id],
        price: m.price,
      }));
      const res = await executePlaceOrder('/api/orders', {
        userId: user.uid,
        venueId,
        standId: cartItems[0].standId || 'stand-a',
        items,
        totalAmount: total,
      });
      if (res) {
        setLastOrder(res);
        setCart({});
        toast.success('Order placed! 🎉 Ready in ~10 min.');
      }
    } catch (err) {
      toast.error('Order failed. Please try again.');
      console.error(err);
    } finally {
      setPlacing(false);
    }
  }, [cartItems, cart, total, user.uid, venueId, executePlaceOrder]);

  /**
   * Group menu items by category, memoized
   */
  const groupedMenu = useMemo(() => {
    if (!menu) return {};
    return menu.reduce((acc, item) => {
      const cat = item.category || 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
  }, [menu]);

  return (
    <div className="pb-32">
      <div className="bg-orange-500 text-white px-4 pt-12 pb-6">
        <h1 className="text-2xl font-bold">Order Food</h1>
        <p className="text-orange-100 text-sm mt-1">Order from your seat — pick up when ready</p>
      </div>

      {lastOrder && (
        <div className="mx-4 mt-4 bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
          <Check size={20} className="text-green-600 mt-0.5" />
          <div>
            <p className="font-semibold text-green-800">Order confirmed!</p>
            <p className="text-sm text-green-700 flex items-center gap-1 mt-0.5">
              <Clock size={12} /> Ready in ~{lastOrder.estimatedReadyMins || 10} minutes
            </p>
            <p className="text-xs text-green-600 mt-1">
              Order ID: {lastOrder.orderId?.slice(0, 8)}
            </p>
          </div>
        </div>
      )}

      <div className="px-4 mt-4 space-y-6">
        {loading ? (
          <p className="text-center text-gray-400 py-10">Loading menu…</p>
        ) : Object.keys(groupedMenu).length === 0 ? (
          <p className="text-center text-gray-400 py-10">Menu not available right now</p>
        ) : (
          Object.entries(groupedMenu).map(([cat, items]) => (
            <div key={cat}>
              <h3 className="font-semibold text-gray-500 text-xs uppercase tracking-wider mb-2">
                {cat}
              </h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl shadow-sm p-3 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 text-sm">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.description}</p>
                      <p className="text-sm font-semibold text-orange-600 mt-0.5">
                        ₹{item.price}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {cart[item.id] > 0 ? (
                        <>
                          <button
                            onClick={() => sub(item.id)}
                            className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"
                            aria-label={`Decrease ${item.name}`}
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-4 text-center font-medium text-sm">
                            {cart[item.id]}
                          </span>
                          <button
                            onClick={() => add(item.id)}
                            className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center"
                            aria-label={`Increase ${item.name}`}
                          >
                            <Plus size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => add(item.id)}
                          className="flex items-center gap-1 bg-orange-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg"
                          aria-label={`Add ${item.name} to cart`}
                        >
                          <Plus size={12} /> Add
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cart Summary */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 px-4">
          <div className="max-w-md mx-auto bg-orange-500 text-white rounded-2xl p-4 shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} />
              <span className="font-semibold">
                {cartItems.length} item(s) · ₹{total.toFixed(2)}
              </span>
            </div>
            <button
              onClick={placeOrder}
              disabled={placing}
              className="bg-white text-orange-600 font-semibold text-sm px-4 py-2 rounded-xl disabled:opacity-50"
              aria-label="Place order"
            >
              {placing ? 'Placing…' : 'Place Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
