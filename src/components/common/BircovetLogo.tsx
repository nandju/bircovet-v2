import { LogoMark } from "@/icons";
import { cn } from "@/utils";

export default function BircovetLogo({ compact = false, className, light = false }: { compact?: boolean; className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-9 shrink-0" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className={cn("text-lg font-bold tracking-wide", light ? "text-white" : "text-gray-900 dark:text-white")}>
            BIRCO<span className="text-brand-500">VET</span>
          </span>
          <span className={cn("mt-0.5 text-[10px] font-medium tracking-[0.18em] uppercase", light ? "text-white/70" : "text-tertiary-600 dark:text-tertiary-400")}>Clinique vétérinaire</span>
        </span>
      )}
    </span>
  );
}
