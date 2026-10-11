"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { BellIcon } from "@/icons";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/utils";
import HeaderPopover, { headerIconBtn } from "./HeaderPopover";

const DOT: Record<string, string> = { info: "bg-tertiary-500", succes: "bg-brand-500", alerte: "bg-warning-500", critique: "bg-error-500" };

export default function NotificationDropdown() {
  const { db, markNotificationsRead } = useDemo();
  const unread = db.notifications.filter((n) => !n.read).length;
  return (
    <HeaderPopover
      className="sm:w-90"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-expanded={open} aria-label="Notifications" className={headerIconBtn}>
          {unread > 0 && (
            <span className="absolute end-0 top-0.5 z-1 flex size-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>
          )}
          <BellIcon />
        </button>
      )}
    >
      {(close) => (
        <div className="flex max-h-[70vh] flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 pt-2 pb-3 dark:border-gray-800">
            <h5 className="text-base font-semibold text-gray-800 dark:text-white/90">Notifications</h5>
            {unread > 0 && (
              <button onClick={markNotificationsRead} className="text-theme-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
                Tout marquer comme lu
              </button>
            )}
          </div>
          <ul className="custom-scrollbar flex-1 overflow-y-auto py-1">
            {db.notifications.length === 0 && <li className="px-3 py-6 text-center text-sm text-gray-500">Aucune notification</li>}
            {db.notifications.slice(0, 20).map((n) => {
              const content = (
                <span className="flex gap-3">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT[n.level], n.read && "opacity-30")} />
                  <span className="min-w-0">
                    <span className={cn("block text-sm text-gray-800 dark:text-white/90", !n.read && "font-medium")}>{n.title}</span>
                    <span className="block text-theme-xs text-gray-500 dark:text-gray-400">{n.body}</span>
                    <span className="block text-[11px] text-gray-400">{formatDateTime(n.date)}</span>
                  </span>
                </span>
              );
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link href={n.link} onClick={close} className="block rounded-lg px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5">
                      {content}
                    </Link>
                  ) : (
                    <div className="px-3 py-2.5">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="border-t border-gray-100 px-3 pt-2 text-[11px] text-gray-400 dark:border-gray-800">Notifications internes de démonstration — aucun SMS, e-mail ou message n&apos;est envoyé.</p>
        </div>
      )}
    </HeaderPopover>
  );
}
