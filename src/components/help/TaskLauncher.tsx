"use client";

import AppModal from "@/components/common/AppModal";
import BodyPortal from "@/components/common/BodyPortal";
import { useDemo } from "@/context/DemoStoreContext";
import { useRouter } from "@/i18n/navigation";
import { normalize } from "@/lib/format";
import type { ModuleId } from "@/lib/permissions";
import { useState } from "react";

interface Task {
  label: string;
  hint: string;
  href: string;
  module: ModuleId;
  action?: "create";
  emoji: string;
}

/** Les tâches courantes, dites simplement, rangées par moment de la journée. */
const GROUPS: { title: string; tasks: Task[] }[] = [
  {
    title: "Recevoir un client",
    tasks: [
      { label: "Donner un rendez-vous", hint: "Agenda", href: "/agenda?nouveau=1", module: "agenda", action: "create", emoji: "📅" },
      { label: "Enregistrer un nouveau client et son animal", hint: "En 30 secondes", href: "/patients?rapide=1", module: "patients", action: "create", emoji: "🐾" },
      { label: "Trouver un client ou un animal", hint: "Recherche", href: "/clients", module: "clients", emoji: "🔎" },
      { label: "Voir qui attend", hint: "File d'attente", href: "/agenda/file-attente", module: "agenda", emoji: "🪑" },
    ],
  },
  {
    title: "Soigner",
    tasks: [
      { label: "Faire une consultation", hint: "Examen, actes, facture", href: "/consultations/nouvelle", module: "consultations", action: "create", emoji: "🩺" },
      { label: "Aller chez un client (domicile)", hint: "Urgence ou visite", href: "/consultations/domicile", module: "consultations", emoji: "🏠" },
      { label: "Calculer une dose", hint: "Selon le poids", href: "/stock/calculateur", module: "stock", emoji: "💉" },
      { label: "Hospitaliser un animal", hint: "Admission", href: "/hospitalisation?nouveau=1", module: "hospitalisation", action: "create", emoji: "🛏️" },
    ],
  },
  {
    title: "Vendre et encaisser",
    tasks: [
      { label: "Vendre un produit", hint: "Comptoir pharmacie", href: "/stock/vente", module: "stock", emoji: "🛒" },
      { label: "Encaisser un paiement", hint: "Facture réglée", href: "/finances/encaissements?nouveau=1", module: "finances", action: "create", emoji: "💵" },
      { label: "Voir l'argent du jour", hint: "Recettes et caisse", href: "/?vue=gestion", module: "dashboard", emoji: "📊" },
      { label: "Voir les factures impayées", hint: "Créances", href: "/finances/creances", module: "finances", emoji: "🧾" },
    ],
  },
  {
    title: "Dépenses et stock",
    tasks: [
      { label: "Noter une dépense (avec photo de la facture)", hint: "Dépenses", href: "/finances/depenses", module: "finances", action: "create", emoji: "📸" },
      { label: "Voir ce qui manque en stock", hint: "Alertes", href: "/stock/alertes", module: "stock", emoji: "📦" },
      { label: "Commander chez un fournisseur", hint: "Bon de commande", href: "/achats?nouveau=1", module: "achats", action: "create", emoji: "🚚" },
      { label: "Suivre un projet", hint: "Coût et preuves", href: "/finances/projets", module: "finances", emoji: "🧱" },
    ],
  },
  {
    title: "Piloter",
    tasks: [
      { label: "Valider les demandes de rendez-vous", hint: "Mon accord", href: "/agenda/demandes", module: "agenda", emoji: "✅" },
      { label: "Voir ce qui rapporte le plus", hint: "Recettes par famille", href: "/rapports/recettes", module: "rapports", emoji: "📈" },
      { label: "Suivre un élevage", hint: "Exploitations", href: "/exploitations", module: "exploitations", emoji: "🐄" },
      { label: "Voir les vaccins et déparasitages à faire", hint: "Prophylaxie", href: "/prophylaxie", module: "patients", emoji: "💉" },
      { label: "Apprendre à utiliser l'application", hint: "Tutoriels vidéo", href: "/aide", module: "dashboard", emoji: "🎓" },
    ],
  },
];

export default function TaskLauncher() {
  const { can } = useDemo();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const t = normalize(q);
  const groups = GROUPS.map((g) => ({ ...g, tasks: g.tasks.filter((x) => can(x.module, x.action) && (!t || normalize(`${x.label} ${x.hint}`).includes(t))) })).filter((g) => g.tasks.length);
  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex h-10 items-center gap-1.5 rounded-full bg-linear-to-br from-brand-500 to-brand-600 px-4 text-sm font-medium text-white shadow-theme-sm hover:from-brand-600 hover:to-brand-700 lg:h-11 lg:px-5">
        <span aria-hidden className="text-base leading-none">＋</span>
        <span className="hidden 2xl:inline">Que voulez-vous faire ?</span>
        <span className="2xl:hidden">Que faire ?</span>
      </button>
      <BodyPortal>
      <AppModal isOpen={open} onClose={() => setOpen(false)} size="xl" title="Que voulez-vous faire ?" description="Touchez une tâche : l'application vous emmène au bon endroit.">
        <div className="space-y-5">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tapez un mot : vente, rendez-vous, dépense…" aria-label="Rechercher une tâche" className="h-12 w-full rounded-2xl border border-gray-300 bg-white px-4 text-base dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" />
          {groups.map((g) => (
            <section key={g.title}>
              <h3 className="mb-2 text-theme-xs font-semibold tracking-wide text-gray-500 uppercase">{g.title}</h3>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {g.tasks.map((x) => (
                  <li key={x.href + x.label}>
                    <button type="button" onClick={() => go(x.href)} className="cliva-press flex min-h-16 w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-start hover:border-brand-400 hover:bg-brand-25 dark:border-gray-700 dark:bg-white/3 dark:hover:bg-white/5">
                      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-2xl dark:bg-white/10">{x.emoji}</span>
                      <span>
                        <span className="block text-sm font-semibold text-gray-800 dark:text-white/90">{x.label}</span>
                        <span className="block text-theme-xs text-gray-500">{x.hint}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!groups.length && <p className="text-center text-sm text-gray-500">Rien trouvé. Essayez un autre mot, ou ouvrez le Centre d&apos;aide.</p>}
        </div>
      </AppModal>
      </BodyPortal>
    </>
  );
}
