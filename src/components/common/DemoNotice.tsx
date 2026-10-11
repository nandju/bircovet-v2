import { InfoIcon } from "@/icons";
import { cn } from "@/utils";

/** Mention explicite des fonctionnalités simulées / dépendant du futur backend. */
export default function DemoNotice({ children, tone = "info", className }: { children: React.ReactNode; tone?: "info" | "warning"; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm",
        tone === "info"
          ? "border-tertiary-200 bg-tertiary-25 text-tertiary-800 dark:border-tertiary-800 dark:bg-tertiary-500/10 dark:text-tertiary-200"
          : "border-warning-200 bg-warning-25 text-warning-800 dark:border-warning-800 dark:bg-warning-500/10 dark:text-warning-200",
        className,
      )}
    >
      <InfoIcon className="mt-0.5 size-4.5 shrink-0" />
      <div className="leading-5">{children}</div>
    </div>
  );
}
