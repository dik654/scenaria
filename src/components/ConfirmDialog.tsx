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
          <div className="bg-white border border-zinc-200 rounded-xl shadow-lg p-6 max-w-sm w-full mx-4">
            <p className="text-zinc-700 text-sm whitespace-pre-line mb-6">{state.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => handleClose(false)}
                className="px-4 py-2 text-sm rounded-lg bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border border-zinc-200"
              >
                {state.cancelLabel}
              </button>
              <button
                onClick={() => handleClose(true)}
                className="px-4 py-2 text-sm rounded-lg bg-blue-500 hover:bg-blue-600 text-white"
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
