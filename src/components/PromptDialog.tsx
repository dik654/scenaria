import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode, KeyboardEvent } from 'react';

interface PromptOptions {
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface PromptContextValue {
  prompt: (options: PromptOptions | string) => Promise<string | null>;
}

const PromptContext = createContext<PromptContextValue | null>(null);

export function PromptDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    open: boolean;
    message: string;
    placeholder: string;
    confirmLabel: string;
    cancelLabel: string;
    resolve: (val: string | null) => void;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  const prompt = useCallback((options: PromptOptions | string): Promise<string | null> => {
    const message = typeof options === 'string' ? options : options.message;
    const placeholder = typeof options === 'string' ? '' : (options.placeholder ?? '');
    const defaultValue = typeof options === 'string' ? '' : (options.defaultValue ?? '');
    const confirmLabel = typeof options === 'string' ? '확인' : (options.confirmLabel ?? '확인');
    const cancelLabel = typeof options === 'string' ? '취소' : (options.cancelLabel ?? '취소');

    return new Promise<string | null>(resolve => {
      setValue(defaultValue);
      setState({ open: true, message, placeholder, confirmLabel, cancelLabel, resolve });
      // focus input on next tick
      setTimeout(() => inputRef.current?.focus(), 50);
    });
  }, []);

  const handleConfirm = () => {
    state?.resolve(value);
    setState(null);
    setValue('');
  };

  const handleCancel = () => {
    state?.resolve(null);
    setState(null);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') handleCancel();
  };

  return (
    <PromptContext.Provider value={{ prompt }}>
      {children}
      {state?.open && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60">
          <div className="bg-white border border-zinc-200 rounded-xl shadow-lg p-6 max-w-sm w-full mx-4">
            <p className="text-zinc-700 text-sm mb-3">{state.message}</p>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={state.placeholder}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 mb-5"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm rounded-lg bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border border-zinc-200"
              >
                {state.cancelLabel}
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm rounded-lg bg-blue-500 hover:bg-blue-600 text-white"
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </PromptContext.Provider>
  );
}

export function usePrompt() {
  const ctx = useContext(PromptContext);
  if (!ctx) throw new Error('usePrompt must be used within PromptDialogProvider');
  return ctx.prompt;
}
