"use client";

import Select from "@/components/form/Select";
import { cn } from "@/utils";
import SearchInput from "./SearchInput";

export interface FilterDef {
  key: string;
  label: string; // libellé « Tous … »
  options: { value: string; label: string }[];
}

interface FilterBarProps {
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  filters?: FilterDef[];
  values?: Record<string, string>;
  onChange?: (key: string, value: string) => void;
  children?: React.ReactNode;
  className?: string;
}

/** Barre de recherche + filtres, empilée sur mobile. */
export default function FilterBar({ search, onSearch, searchPlaceholder, filters = [], values = {}, onChange, children, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-col gap-2 px-4 pb-4 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      {onSearch && <SearchInput value={search ?? ""} onChange={onSearch} placeholder={searchPlaceholder} className="sm:max-w-xs" />}
      {filters.map((f) => (
        <div key={f.key} className="sm:w-48">
          <Select value={values[f.key] ?? ""} onChange={(v) => onChange?.(f.key, v)} options={f.options} placeholder={f.label} allowEmpty />
        </div>
      ))}
      {children}
    </div>
  );
}
