import { cn } from "@/utils";
import React from "react";

interface TextareaProps {
  placeholder?: string; // Placeholder text
  rows?: number; // Number of rows
  value?: string; // Current value
  onChange?: (value: string) => void; // Change handler
  className?: string; // Additional CSS classes
  disabled?: boolean; // Disabled state
  error?: boolean; // Error state
  hint?: string; // Hint text to display
  id?: string;
}

const TextArea: React.FC<TextareaProps> = ({
  placeholder = "",
  rows = 3,
  value = "",
  onChange,
  className = "",
  disabled = false,
  error = false,
  hint = "",
  id,
}) => {
  return (
    <div className="relative">
      <textarea
        id={id}
        placeholder={placeholder}
        rows={rows}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className={cn(
          "w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30",
          disabled && "cursor-not-allowed border-gray-300 bg-gray-100 opacity-50 dark:border-gray-700 dark:bg-gray-800",
          error ? "border-error-500 focus:ring-error-500/10" : "border-gray-300 focus:border-brand-300 focus:ring-brand-500/10 dark:border-gray-700 dark:focus:border-brand-800",
          className,
        )}
      />
      {hint && <p className={cn("mt-1.5 text-xs", error ? "text-error-500" : "text-gray-500 dark:text-gray-400")}>{hint}</p>}
    </div>
  );
};

export default TextArea;
