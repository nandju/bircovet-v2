import { cn } from "@/utils";

/** Conteneur de liste (tableau + filtres) cohérent avec les cartes du thème. */
export default function Panel({ children, className, title, actions }: { children: React.ReactNode; className?: string; title?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-gray-200 bg-white pt-4 pb-4 dark:border-gray-800 dark:bg-white/3", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4">
          {title && <h3 className="text-base font-medium text-gray-800 dark:text-white/90">{title}</h3>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
