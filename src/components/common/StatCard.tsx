import { Link } from "@/i18n/navigation";
import { ArrowDownIcon, ArrowUpIcon } from "@/icons";
import { cn } from "@/utils";

type Tone = "brand" | "tertiary" | "secondary" | "warning" | "error";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tone?: Tone;
  delta?: { value: number; label: string; positiveIsGood?: boolean };
  hint?: string;
  href?: string;
}

const TONES: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
  tertiary: "bg-tertiary-50 text-tertiary-600 dark:bg-tertiary-500/15 dark:text-tertiary-300",
  secondary: "bg-secondary-50 text-secondary-700 dark:bg-secondary-500/15 dark:text-secondary-300",
  warning: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400",
  error: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
};

/** Carte KPI : icône, valeur, libellé, comparaison avec la période précédente. */
export default function StatCard({ label, value, icon, tone = "brand", delta, hint, href }: StatCardProps) {
  const good = delta ? (delta.positiveIsGood ?? true) === delta.value >= 0 : true;
  const body = (
    <div className="flex h-full flex-col justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 transition hover:shadow-theme-sm sm:p-5 dark:border-gray-800 dark:bg-white/3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl [&>svg]:size-5", TONES[tone])}>{icon}</span>
      </div>
      <div>
        <p className="text-xl font-semibold text-gray-800 sm:text-2xl dark:text-white/90">{value}</p>
        {delta ? (
          <p className="mt-1 flex flex-wrap items-center gap-1 text-theme-xs text-gray-500 dark:text-gray-400">
            <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium", good ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400" : "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400")}>
              {delta.value >= 0 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />}
              {Math.abs(delta.value).toFixed(0)} %
            </span>
            {delta.label}
          </p>
        ) : (
          hint && <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">{hint}</p>
        )}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
