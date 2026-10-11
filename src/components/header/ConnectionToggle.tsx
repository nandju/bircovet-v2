"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { WifiIcon, WifiOffIcon } from "@/icons";
import { cn } from "@/utils";
import HeaderPopover from "./HeaderPopover";

/** Indicateur de connexion + bascule du mode hors ligne SIMULÉ. */
export default function ConnectionToggle() {
  const { session, setOffline, db } = useDemo();
  const pending = db.syncQueue.filter((o) => o.status !== "synchronise").length;
  return (
    <HeaderPopover
      className="sm:w-80"
      trigger={({ toggle, open }) => (
        <button
          onClick={toggle}
          aria-expanded={open}
          title={session.offline ? "Mode hors ligne — Simulation" : "Connecté (simulé)"}
          className={cn(
            "relative flex h-10 items-center gap-1.5 rounded-full border px-3 text-theme-xs font-medium lg:h-11",
            session.offline ? "border-warning-300 bg-warning-50 text-warning-700 dark:border-warning-700 dark:bg-warning-500/10 dark:text-warning-300" : "border-brand-200 bg-brand-25 text-brand-700 dark:border-brand-800 dark:bg-brand-500/10 dark:text-brand-300",
          )}
        >
          {session.offline ? <WifiOffIcon className="size-4" /> : <WifiIcon className="size-4" />}
          <span className="hidden 2xl:inline">{session.offline ? "Hors ligne (simulé)" : "En ligne (simulé)"}</span>
          {pending > 0 && <span className="rounded-full bg-warning-500 px-1.5 text-[10px] text-white">{pending}</span>}
        </button>
      )}
    >
      {(close) => (
        <div className="space-y-3 p-2">
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">{session.offline ? "Mode hors ligne — Simulation" : "Connexion normale (simulée)"}</p>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            Le mode hors ligne permet de tester la saisie de notes et rapports en attente de synchronisation. Les crédits, changements de politique financière, validations de facture et ajustements de stock sensibles sont bloqués. Ce n&apos;est pas un système de synchronisation réel.
          </p>
          {pending > 0 && <p className="text-theme-xs font-medium text-warning-700 dark:text-warning-400">{pending} opération(s) en attente ou en conflit.</p>}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setOffline(!session.offline);
                close();
              }}
              className={cn("rounded-lg px-3 py-2 text-sm font-medium text-white", session.offline ? "bg-brand-500 hover:bg-brand-600" : "bg-warning-500 hover:bg-warning-600")}
            >
              {session.offline ? "Simuler le retour de connexion" : "Passer hors ligne (simulation)"}
            </button>
            <Link href="/administration/demo#synchronisation" onClick={close} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">
              File de synchronisation
            </Link>
          </div>
        </div>
      )}
    </HeaderPopover>
  );
}
