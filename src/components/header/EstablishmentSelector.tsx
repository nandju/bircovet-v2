"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { BuildingIcon, CheckLineIcon, ChevronDownIcon } from "@/icons";
import { cn } from "@/utils";
import HeaderPopover from "./HeaderPopover";

export default function EstablishmentSelector() {
  const { db, establishment, setEstablishment } = useDemo();
  return (
    <HeaderPopover
      align="start"
      className="sm:w-80"
      trigger={({ open, toggle }) => (
        <button onClick={toggle} aria-expanded={open} className="flex h-10 max-w-56 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50 lg:h-11 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5">
          <BuildingIcon className="size-4.5 shrink-0 text-tertiary-500" />
          <span className="truncate">{establishment?.name.replace("BIRCOVET ", "")}</span>
          <ChevronDownIcon className={cn("size-4 shrink-0 transition", open && "rotate-180")} />
        </button>
      )}
    >
      {(close) => (
        <div>
          <p className="px-3 pt-2 pb-1 text-theme-xs font-medium tracking-wide text-gray-400 uppercase">Établissement de démonstration</p>
          {db.establishments
            .filter((e) => e.active)
            .map((e) => (
              <button
                key={e.id}
                onClick={() => {
                  setEstablishment(e.id);
                  close();
                }}
                className={cn("flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-start hover:bg-gray-50 dark:hover:bg-white/5", e.id === establishment?.id && "bg-brand-25 dark:bg-brand-500/10")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-800 dark:text-white/90">{e.name}</span>
                  <span className="block text-theme-xs text-gray-500 dark:text-gray-400">
                    {e.city} · créneau {e.slotMinutes} min
                  </span>
                </span>
                {e.id === establishment?.id && <CheckLineIcon className="mt-1 size-4 text-brand-500" />}
              </button>
            ))}
        </div>
      )}
    </HeaderPopover>
  );
}
