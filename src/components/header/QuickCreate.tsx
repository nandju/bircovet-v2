"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { BedIcon, CalenderIcon, CartIcon, PawIcon, PlusIcon, ReceiptIcon, StethoscopeIcon, TaskIcon, UsersIcon, WalletIcon } from "@/icons";
import type { ModuleId } from "@/lib/permissions";
import HeaderPopover from "./HeaderPopover";

const ITEMS: { label: string; href: string; module: ModuleId; icon: React.ReactNode }[] = [
  { label: "Rendez-vous", href: "/agenda?nouveau=1", module: "agenda", icon: <CalenderIcon /> },
  { label: "Client", href: "/clients/nouveau", module: "clients", icon: <UsersIcon /> },
  { label: "Patient", href: "/patients?nouveau=1", module: "patients", icon: <PawIcon /> },
  { label: "Consultation", href: "/consultations/nouvelle", module: "consultations", icon: <StethoscopeIcon /> },
  { label: "Admission", href: "/hospitalisation?nouveau=1", module: "hospitalisation", icon: <BedIcon /> },
  { label: "Devis", href: "/facturation/devis?nouveau=1", module: "facturation", icon: <ReceiptIcon /> },
  { label: "Encaissement", href: "/finances/encaissements?nouveau=1", module: "finances", icon: <WalletIcon /> },
  { label: "Commande d'achat", href: "/achats?nouveau=1", module: "achats", icon: <CartIcon /> },
  { label: "Tâche", href: "/relation-client?nouveau=1", module: "relation", icon: <TaskIcon /> },
];

export default function QuickCreate() {
  const { can } = useDemo();
  const items = ITEMS.filter((i) => can(i.module, "create"));
  if (!items.length) return null;
  return (
    <HeaderPopover
      className="sm:w-72"
      trigger={({ open, toggle }) => (
        <button onClick={toggle} aria-expanded={open} className="flex h-10 items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 lg:h-11 lg:px-4">
          <PlusIcon className="size-4" />
          <span className="hidden sm:inline">Créer</span>
        </button>
      )}
    >
      {(close) => (
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-1">
          <p className="col-span-full px-3 pt-2 pb-1 text-theme-xs font-medium tracking-wide text-gray-400 uppercase">Création rapide</p>
          {items.map((i) => (
            <Link key={i.href} href={i.href} onClick={close} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-brand-25 hover:text-brand-700 dark:text-gray-300 dark:hover:bg-white/5 [&_svg]:size-4.5">
              <span className="text-brand-500">{i.icon}</span>
              {i.label}
            </Link>
          ))}
        </div>
      )}
    </HeaderPopover>
  );
}
