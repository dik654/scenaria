import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

interface ConfirmOptions {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    open: boolean;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    resolve: (val: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    const message = typeof options === 'string' ? options : options.message;
    const confirmLabel = typeof options === 'string' ? '확인' : (options.confirmLabel ?? '확인');
    const cancelLabel = typeof options === 'string' ? '취소' : (options.cancelLabel ?? '취소');

    return new Promise<boolean>(resolve => {
      setState({ open: true, message, confirmLabel, cancelLabel, resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state?.open && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <p className="text-gray-100 text-sm whitespace-pre-line mb-6">{state.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => handleClose(false)}
                className="px-4 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600"
              >
                {state.cancelLabel}
              </button>
              <button
                onClick={() => handleClose(true)}
                className="px-4 py-2 text-sm rounded-lg bg-red-700 hover:bg-red-600 text-white"
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmDialogProvider');
  return ctx.confirm;
}
