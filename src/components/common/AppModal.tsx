"use client";

import { Modal } from "@/components/ui/modal";
import { cn } from "@/utils";

interface AppModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const SIZES = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };

/** Modale applicative : en-tête, corps défilant (adapté à la hauteur mobile), pied d'actions. */
export default function AppModal({ isOpen, onClose, title, description, size = "md", children, footer }: AppModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} className={cn("m-3 flex max-h-[92dvh] flex-col rounded-2xl! sm:m-6", SIZES[size])}>
      <div className="flex max-h-[92dvh] flex-col">
        <div className="border-b border-gray-100 px-5 pt-5 pb-4 pe-16 sm:px-6 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h3>
          {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
        <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 dark:border-gray-800">{footer}</div>}
      </div>
    </Modal>
  );
}
