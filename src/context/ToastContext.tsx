"use client";

import { AlertTriangleIcon, CheckCircleIcon, CloseIcon, InfoIcon } from "@/icons";
import { cn } from "@/utils";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastType = "success" | "error" | "info" | "warning";
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastCtx {
  show: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastCtx | undefined>(undefined);

export const useToast = () => {
  const c = useContext(ToastContext);
  if (!c) throw new Error("useToast must be used within ToastProvider");
  return c;
};

const STYLES: Record<ToastType, string> = {
  success: "border-brand-200 bg-brand-25 text-brand-800 dark:border-brand-800 dark:bg-gray-900 dark:text-brand-300",
  error: "border-error-200 bg-error-25 text-error-800 dark:border-error-800 dark:bg-gray-900 dark:text-error-300",
  warning: "border-warning-200 bg-warning-25 text-warning-800 dark:border-warning-800 dark:bg-gray-900 dark:text-warning-300",
  info: "border-tertiary-200 bg-tertiary-25 text-tertiary-800 dark:border-tertiary-800 dark:bg-gray-900 dark:text-tertiary-300",
};

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (type: ToastType, message: string) => {
      const id = ++counter;
      setToasts((t) => [...t.slice(-3), { id, type, message }]);
      setTimeout(() => dismiss(id), type === "error" ? 7000 : 4500);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-999999 flex flex-col items-end gap-2 sm:inset-x-auto sm:end-5 sm:bottom-5 print:hidden" aria-live="polite">
        {toasts.map((t) => {
          const Icon = t.type === "success" ? CheckCircleIcon : t.type === "info" ? InfoIcon : AlertTriangleIcon;
          return (
            <div key={t.id} role="status" className={cn("pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-theme-lg", STYLES[t.type])}>
              <Icon className="mt-0.5 size-5 shrink-0" />
              <p className="flex-1 leading-5">{t.message}</p>
              <button onClick={() => dismiss(t.id)} aria-label="Fermer" className="shrink-0 opacity-60 hover:opacity-100">
                <CloseIcon className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
