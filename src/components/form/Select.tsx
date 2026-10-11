"use client";

import { ChevronDownIcon } from "@/icons";
import { cn } from "@/utils";
import { useState } from "react";

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  options: Option[];
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
  defaultValue?: string;
  value?: string; // mode contrôlé
  id?: string;
  disabled?: boolean;
  allowEmpty?: boolean; // le placeholder reste sélectionnable (filtres « Tous »)
  error?: boolean;
}

const Select: React.FC<SelectProps> = ({
  options,
  placeholder = "Sélectionner",
  onChange,
  className = "",
  defaultValue = "",
  value,
  id,
  disabled,
  allowEmpty = false,
  error = false,
}) => {
  const [inner, setInner] = useState<string>(defaultValue);
  const selectedValue = value ?? inner;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setInner(e.target.value);
    onChange(e.target.value);
  };

  return (
    <div className="relative">
      <select
        id={id}
        disabled={disabled}
        className={cn(
          "h-11 w-full appearance-none rounded-lg border bg-transparent px-4 py-2.5 pe-11 text-sm shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-900 dark:focus:border-brand-800",
          error ? "border-error-500" : "border-gray-300 dark:border-gray-700",
          selectedValue ? "text-gray-800 dark:text-white/90" : "text-gray-400 dark:text-gray-400",
          className,
        )}
        value={selectedValue}
        onChange={handleChange}
      >
        <option value="" disabled={!allowEmpty} className="text-gray-700 dark:bg-gray-900 dark:text-gray-400">
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled} className="text-gray-700 dark:bg-gray-900 dark:text-gray-400">
            {option.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
        <ChevronDownIcon />
      </span>
    </div>
  );
};

export default Select;
