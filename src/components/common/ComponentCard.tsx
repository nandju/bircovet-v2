import { cn } from "@/utils";
import React from "react";

interface ComponentCardProps {
  title: string;
  children: React.ReactNode;
  className?: string; // Additional custom classes for styling
  desc?: string; // Description text
  actions?: React.ReactNode; // Actions affichées dans l'en-tête
  bodyClassName?: string;
}

const ComponentCard: React.FC<ComponentCardProps> = ({ title, children, className = "", desc = "", actions, bodyClassName }) => {
  return (
    <div className={cn("min-w-0 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3", className)}>
      {/* Card Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-base font-medium text-gray-800 dark:text-white/90">{title}</h3>
          {desc && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{desc}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
      </div>

      {/* Card Body */}
      <div className={cn("border-t border-gray-100 p-4 sm:p-5 dark:border-gray-800", bodyClassName)}>
        <div className="space-y-5">{children}</div>
      </div>
    </div>
  );
};

export default ComponentCard;
