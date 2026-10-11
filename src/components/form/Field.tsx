"use client";

import Input from "@/components/form/input/InputField";
import TextArea from "@/components/form/input/TextArea";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { cn } from "@/utils";
import { useId } from "react";

interface BaseProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
}

function Wrap({ label, required, hint, error, className, id, children }: BaseProps & { id: string; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      <Label htmlFor={id}>
        {label} {required && <span className="text-error-500">*</span>}
      </Label>
      {children}
      {(error || hint) && <p className={cn("mt-1.5 text-xs", error ? "text-error-500" : "text-gray-500 dark:text-gray-400")}>{error || hint}</p>}
    </div>
  );
}

export function TextField(
  props: BaseProps & {
    value: string | number;
    onChange: (v: string) => void;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    min?: string | number;
    max?: string | number;
    step?: number;
  },
) {
  const id = useId();
  const { value, onChange, type = "text", placeholder, disabled, min, max, step, ...base } = props;
  return (
    <Wrap {...base} id={id}>
      <Input id={id} type={type} value={value} placeholder={placeholder} disabled={disabled} min={min} max={max} step={step} error={!!base.error} onChange={(e) => onChange(e.target.value)} />
    </Wrap>
  );
}

export function NumberField(props: BaseProps & { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; disabled?: boolean; suffix?: string }) {
  const id = useId();
  const { value, onChange, min, max, step, disabled, suffix, ...base } = props;
  return (
    <Wrap {...base} id={id}>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ""}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          error={!!base.error}
          className={suffix ? "pe-14" : ""}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
        />
        {suffix && <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400">{suffix}</span>}
      </div>
    </Wrap>
  );
}

export function SelectField(
  props: BaseProps & {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string; disabled?: boolean }[];
    placeholder?: string;
    disabled?: boolean;
    allowEmpty?: boolean;
  },
) {
  const id = useId();
  const { value, onChange, options, placeholder, disabled, allowEmpty, ...base } = props;
  return (
    <Wrap {...base} id={id}>
      <Select id={id} value={value} onChange={onChange} options={options} placeholder={placeholder ?? "Sélectionner"} disabled={disabled} allowEmpty={allowEmpty} error={!!base.error} />
    </Wrap>
  );
}

export function TextAreaField(props: BaseProps & { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; disabled?: boolean }) {
  const id = useId();
  const { value, onChange, rows, placeholder, disabled, ...base } = props;
  return (
    <Wrap {...base} id={id}>
      <TextArea id={id} value={value} onChange={onChange} rows={rows ?? 3} placeholder={placeholder} disabled={disabled} error={!!base.error} />
    </Wrap>
  );
}

export function CheckField({ label, checked, onChange, hint, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-3 rounded-lg py-1", disabled && "cursor-not-allowed opacity-50")}>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4.5 shrink-0 rounded border-gray-300 text-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900" />
      <span className="text-sm text-gray-700 dark:text-gray-300">
        {label}
        {hint && <span className="block text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
      </span>
    </label>
  );
}

export function FormGrid({ children, cols = 2, className }: { children: React.ReactNode; cols?: 1 | 2 | 3; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-4", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-2 lg:grid-cols-3", className)}>{children}</div>;
}
