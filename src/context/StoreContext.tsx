import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { CartResponse, NotificationItem } from '../lib/api';
import { useAuth } from './AuthContext';

interface StoreValue {
  cart: CartResponse;
  notifications: NotificationItem[];
  unreadNotifications: number;
  unreadMessages: number;
  isSelect: boolean;
  loading: boolean;
  refreshCart: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  refreshMessages: () => Promise<void>;
  refreshSelect: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const EMPTY_CART: CartResponse = { items: [], total: 0, credits: 0, count: 0 };

const StoreContext = createContext<StoreValue | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartResponse>(EMPTY_CART);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isSelect, setIsSelect] = useState(false);
  const [loading, setLoading] = useState(false);

  const refreshCart = useCallback(async () => {
    if (!user) {
      setCart(EMPTY_CART);
      return;
    }
    const data = await api.cart.get();
    setCart(data);
  }, [user]);

  const refreshNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadNotifications(0);
      return;
    }
    const data = await api.notifications.list();
    setNotifications(data.items);
    setUnreadNotifications(data.unread);
  }, [user]);

  const refreshMessages = useCallback(async () => {
    if (!user) {
      setUnreadMessages(0);
      return;
    }
    const data = await api.messages.list();
    setUnreadMessages(data.unread);
  }, [user]);

  const refreshSelect = useCallback(async () => {
    if (!user) {
      setIsSelect(false);
      return;
    }
    const data = await api.select.status();
    setIsSelect(data.isSelect);
  }, [user]);

  const refreshAll = useCallback(async () => {
    if (!user) {
      setCart(EMPTY_CART);
      setNotifications([]);
      setUnreadNotifications(0);
      setUnreadMessages(0);
      setIsSelect(false);
      return;
    }
    setLoading(true);
    try {
      await Promise.all([
        refreshCart(),
        refreshNotifications(),
        refreshMessages(),
        refreshSelect(),
      ]);
    } finally {
      setLoading(false);
    }
  }, [user, refreshCart, refreshNotifications, refreshMessages, refreshSelect]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!user) return;
    const beat = () => {
      void api.presence.beat().catch(() => undefined);
    };
    beat();
    const timer = window.setInterval(beat, 60000);
    return () => window.clearInterval(timer);
  }, [user]);

  const value = useMemo<StoreValue>(
    () => ({
      cart,
      notifications,
      unreadNotifications,
      unreadMessages,
      isSelect,
      loading,
      refreshCart,
      refreshNotifications,
      refreshMessages,
      refreshSelect,
      refreshAll,
    }),
    [
      cart,
      notifications,
      unreadNotifications,
      unreadMessages,
      isSelect,
      loading,
      refreshCart,
      refreshNotifications,
      refreshMessages,
      refreshSelect,
      refreshAll,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export function useStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore debe usarse dentro de <StoreProvider>.');
  return context;
}
