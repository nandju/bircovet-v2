import {
  BedIcon,
  CalenderIcon,
  CartIcon,
  ChartBarIcon,
  ContactIcon,
  DocsIcon,
  FarmIcon,
  GraduationIcon,
  GridIcon,
  PawIcon,
  PillIcon,
  ReceiptIcon,
  SettingsIcon,
  SparklesIcon,
  StethoscopeIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
} from "@/icons";
import type { ModuleId } from "@/lib/permissions";

export interface NavSubItem {
  key: string;
  path: string;
  module?: ModuleId;
}

export interface NavItem {
  key: string;
  icon: React.ReactNode;
  module: ModuleId;
  path?: string;
  subItems?: NavSubItem[];
}

export interface NavGroup {
  key: string;
  items: NavItem[];
}

/** Structure de navigation BIRCOVET (libellés dans messages/fr.json → sidebar.items). */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: "pilotage",
    items: [{ key: "overview", icon: <GridIcon />, module: "dashboard", path: "/" }],
  },
  {
    key: "clinique",
    items: [
      {
        key: "agenda",
        icon: <CalenderIcon />,
        module: "agenda",
        subItems: [
          { key: "agendaCalendar", path: "/agenda" },
          { key: "agendaQueue", path: "/agenda/file-attente" },
        ],
      },
      {
        key: "clients",
        icon: <UsersIcon />,
        module: "clients",
        subItems: [
          { key: "clientsList", path: "/clients" },
          { key: "clientsNew", path: "/clients/nouveau" },
          { key: "clientsMerge", path: "/clients/fusion" },
        ],
      },
      { key: "patients", icon: <PawIcon />, module: "patients", path: "/patients" },
      { key: "farms", icon: <FarmIcon />, module: "exploitations", path: "/exploitations" },
      {
        key: "consultations",
        icon: <StethoscopeIcon />,
        module: "consultations",
        subItems: [
          { key: "consultationsList", path: "/consultations" },
          { key: "consultationsNew", path: "/consultations/nouvelle" },
          { key: "prescriptions", path: "/prescriptions", module: "prescriptions" },
        ],
      },
      { key: "hospitalization", icon: <BedIcon />, module: "hospitalisation", path: "/hospitalisation" },
      { key: "missions", icon: <TruckIcon />, module: "missions", path: "/missions" },
    ],
  },
  {
    key: "gestion",
    items: [
      {
        key: "stock",
        icon: <PillIcon />,
        module: "stock",
        subItems: [
          { key: "stockOverview", path: "/stock" },
          { key: "stockCatalog", path: "/stock/catalogue" },
          { key: "stockLots", path: "/stock/lots" },
          { key: "stockMovements", path: "/stock/mouvements" },
          { key: "stockInventories", path: "/stock/inventaires" },
          { key: "stockTransfers", path: "/stock/transferts" },
          { key: "stockCorrections", path: "/stock/corrections" },
          { key: "stockAlerts", path: "/stock/alertes" },
        ],
      },
      {
        key: "purchases",
        icon: <CartIcon />,
        module: "achats",
        subItems: [
          { key: "purchaseOrders", path: "/achats" },
          { key: "receptions", path: "/achats/receptions" },
          { key: "suppliers", path: "/achats/fournisseurs" },
        ],
      },
      {
        key: "billing",
        icon: <ReceiptIcon />,
        module: "facturation",
        subItems: [
          { key: "invoices", path: "/facturation" },
          { key: "quotes", path: "/facturation/devis" },
          { key: "creditNotes", path: "/facturation/avoirs" },
          { key: "groupedBilling", path: "/facturation/regroupee" },
        ],
      },
      {
        key: "finance",
        icon: <WalletIcon />,
        module: "finances",
        subItems: [
          { key: "financeOverview", path: "/finances" },
          { key: "payments", path: "/finances/encaissements" },
          { key: "expenses", path: "/finances/depenses" },
          { key: "accounts", path: "/finances/comptes" },
          { key: "credits", path: "/finances/credits" },
          { key: "receivables", path: "/finances/creances" },
        ],
      },
    ],
  },
  {
    key: "relation",
    items: [
      {
        key: "crm",
        icon: <ContactIcon />,
        module: "relation",
        subItems: [
          { key: "tasks", path: "/relation-client" },
          { key: "reminders", path: "/relation-client/rappels" },
          { key: "interactions", path: "/relation-client/interactions" },
        ],
      },
      { key: "trainings", icon: <GraduationIcon />, module: "formations", path: "/formations" },
      { key: "documents", icon: <DocsIcon />, module: "documents", path: "/documents" },
      { key: "reports", icon: <ChartBarIcon />, module: "rapports", path: "/rapports" },
      { key: "assistant", icon: <SparklesIcon />, module: "ia", path: "/assistant-ia" },
    ],
  },
  {
    key: "admin",
    items: [
      {
        key: "administration",
        icon: <SettingsIcon />,
        module: "admin",
        subItems: [
          { key: "users", path: "/administration/utilisateurs" },
          { key: "roles", path: "/administration/roles" },
          { key: "establishments", path: "/administration/etablissements" },
          { key: "settings", path: "/administration/parametres" },
          { key: "audit", path: "/administration/journal" },
          { key: "demo", path: "/administration/demo" },
        ],
      },
    ],
  },
];

/** Module associé à une route (pour la protection de navigation simulée). */
export function moduleForPath(pathname: string): ModuleId | null {
  if (pathname === "/" || pathname === "") return "dashboard";
  if (pathname.startsWith("/profil")) return null;
  if (pathname.startsWith("/administration/demo")) return null; // environnement de démo accessible à tous
  if (pathname.startsWith("/prescriptions")) return "prescriptions";
  for (const g of NAV_GROUPS)
    for (const it of g.items) {
      const paths = [it.path, ...(it.subItems?.map((s) => s.path) ?? [])].filter((p): p is string => !!p && p !== "/");
      if (paths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return it.module;
    }
  return null;
}
