import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchAlerts, markAlertRead, ApiAlert } from '../api';
import { useAuth } from './AuthContext';
import { useCity } from './CityContext';

interface Alert {
  id: string;
  module: string;
  summary: string;
  created_at: string;
  read: boolean;
}

interface AlertsContextValue {
  alerts: Alert[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const AlertsContext = createContext<AlertsContextValue | null>(null);

function toUiAlert(a: ApiAlert): Alert {
  return {
    id: String(a.id),
    module: a.module,
    summary: a.message,
    created_at: a.created_at,
    read: a.read,
  };
}

export function AlertsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { selectedCity } = useCity();
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Reload alerts whenever the logged-in user or city changes, then poll every 60s
  useEffect(() => {
    if (!user) {
      setAlerts([]);
      return;
    }
    const load = () => fetchAlerts({ city: selectedCity }).then(rows => setAlerts(rows.map(toUiAlert))).catch(() => {});
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [user?.id, selectedCity]);

  const unreadCount = alerts.filter(a => !a.read).length;

  const markRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
    markAlertRead(Number(id)).catch(() => {});
  };

  const markAllRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
    alerts.filter(a => !a.read).forEach(a => markAlertRead(Number(a.id)).catch(() => {}));
  };

  return (
    <AlertsContext.Provider value={{ alerts, unreadCount, markRead, markAllRead }}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error('useAlerts must be used within AlertsProvider');
  return ctx;
}
