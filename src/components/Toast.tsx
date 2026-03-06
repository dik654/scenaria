import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++counter.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const colorMap: Record<ToastType, string> = {
    success: 'bg-green-800 border-green-600 text-green-100',
    error: 'bg-red-900 border-red-700 text-red-100',
    info: 'bg-gray-800 border-gray-600 text-gray-100',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-[9999] pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-lg border text-sm shadow-lg animate-fade-in ${colorMap[t.type]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
}
