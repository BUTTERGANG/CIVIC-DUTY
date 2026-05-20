// src/context/ToastContext.tsx — global toast notification system

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { X, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface Toast {
  id: number;
  message: string;
  type: 'error' | 'success' | 'info';
}

interface ToastContextValue {
  toasts: Toast[];
  showError: (msg: string) => void;
  showSuccess: (msg: string) => void;
  showInfo: (msg: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((message: string, type: Toast['type']) => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{
      toasts,
      showError: (msg) => add(msg, 'error'),
      showSuccess: (msg) => add(msg, 'success'),
      showInfo: (msg) => add(msg, 'info'),
      dismiss,
    }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ── Toast Container (fixed position overlay) ──────────────────────────────────

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl animate-slide-in-right ${
            t.type === 'error'
              ? 'bg-danger/10 border-danger/30 text-danger'
              : t.type === 'success'
              ? 'bg-success/10 border-success/30 text-success'
              : 'bg-primary/10 border-primary/30 text-primary'
          }`}
        >
          <div className="shrink-0 mt-0.5">
            {t.type === 'error' ? <AlertTriangle size={16} /> : t.type === 'success' ? <CheckCircle2 size={16} /> : <Info size={16} />}
          </div>
          <p className="text-sm flex-1 text-slate-200">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="shrink-0 text-slate-500 hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
