"use client";

import { useClickOutside } from "@/hooks/useClickOutside";
import { cn } from "@/utils";
import { useCallback, useRef, useState } from "react";

interface HeaderPopoverProps {
  trigger: (p: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  className?: string;
  align?: "start" | "end";
}

/** Menu déroulant d'en-tête : fermeture au clic extérieur et sur Échap. */
export default function HeaderPopover({ trigger, children, className, align = "end" }: HeaderPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);
  return (
    <div ref={ref} className="relative" onKeyDown={(e) => e.key === "Escape" && close()}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={cn(
            "fixed inset-x-3 top-[4.5rem] z-99999 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg sm:absolute sm:inset-x-auto sm:top-full sm:mt-2 dark:border-gray-800 dark:bg-gray-dark",
            align === "end" ? "sm:end-0" : "sm:start-0",
            className,
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

export const headerIconBtn =
  "relative flex size-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 lg:size-11 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white [&>svg]:size-5";
