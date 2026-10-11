"use client";

import AvatarInitials from "@/components/common/AvatarInitials";
import { useDemo } from "@/context/DemoStoreContext";
import { Link, useRouter } from "@/i18n/navigation";
import { ChevronDownIcon, LogoutIcon, RefreshIcon, SettingsIcon, UserCircleIcon } from "@/icons";
import { ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/utils";
import { useState } from "react";
import HeaderPopover from "./HeaderPopover";

export default function UserDropdown() {
  const { user, db, logout, switchUser } = useDemo();
  const router = useRouter();
  const [showSwitch, setShowSwitch] = useState(false);
  if (!user) return null;

  return (
    <HeaderPopover
      className="sm:w-80"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-expanded={open} className="flex items-center gap-2 text-gray-700 dark:text-gray-400">
          <AvatarInitials name={user.name} />
          <span className="hidden min-w-0 text-start lg:block">
            <span className="block max-w-36 truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">{user.name}</span>
            <span className="block max-w-36 truncate text-theme-xs text-gray-500">{ROLE_LABELS[user.roleId]}</span>
          </span>
          <ChevronDownIcon className={cn("size-4 transition", open && "rotate-180")} />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="border-b border-gray-100 px-3 pt-2 pb-3 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">{user.name}</p>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">{user.email}</p>
            <p className="mt-1 inline-block rounded-full bg-tertiary-50 px-2 py-0.5 text-theme-xs font-medium text-tertiary-700 dark:bg-tertiary-500/15 dark:text-tertiary-300">{ROLE_LABELS[user.roleId]}</p>
          </div>
          <ul className="space-y-0.5 py-2 [&_svg]:size-4.5">
            <li>
              <Link href="/profil" onClick={close} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5">
                <UserCircleIcon /> Mon profil
              </Link>
            </li>
            <li>
              <button onClick={() => setShowSwitch((s) => !s)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5">
                <RefreshIcon /> Changer de profil de démonstration
                <ChevronDownIcon className={cn("ms-auto transition", showSwitch && "rotate-180")} />
              </button>
              {showSwitch && (
                <ul className="custom-scrollbar ms-6 max-h-60 overflow-y-auto border-s border-gray-100 ps-2 dark:border-gray-800">
                  {db.users
                    .filter((u) => u.active)
                    .map((u) => (
                      <li key={u.id}>
                        <button
                          onClick={() => {
                            switchUser(u.id);
                            close();
                            router.push("/");
                          }}
                          className={cn("block w-full rounded-lg px-2.5 py-1.5 text-start hover:bg-gray-50 dark:hover:bg-white/5", u.id === user.id && "bg-brand-25 dark:bg-brand-500/10")}
                        >
                          <span className="block text-sm text-gray-800 dark:text-white/90">{u.name}</span>
                          <span className="block text-theme-xs text-gray-500">{ROLE_LABELS[u.roleId]}</span>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </li>
            <li>
              <Link href="/administration/demo" onClick={close} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5">
                <SettingsIcon /> Préférences et environnement de démo
              </Link>
            </li>
          </ul>
          <button
            onClick={() => {
              close();
              logout();
              router.replace("/signin");
            }}
            className="flex w-full items-center gap-3 rounded-lg border-t border-gray-100 px-3 py-2.5 text-sm font-medium text-error-600 hover:bg-error-25 dark:border-gray-800 dark:text-error-400 dark:hover:bg-error-500/10 [&_svg]:size-4.5"
          >
            <LogoutIcon /> Se déconnecter
          </button>
        </div>
      )}
    </HeaderPopover>
  );
}
