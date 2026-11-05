import {
  BedIcon,
  BoxIcon,
  TaskIcon,
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
  SyringeIcon,
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
  /** Autre module qui donne aussi accès à l'entrée (ex. prophylaxie : patients ou exploitations). */
  orModule?: ModuleId;
  path?: string;
  subItems?: NavSubItem[];
}

export interface NavGroup {
  key: string;
  items: NavItem[];
}

/** Structure de navigation Cliva (libellés dans messages/fr.json → sidebar.items). */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: "plateforme",
    items: [
      { key: "editorOverview", icon: <GridIcon />, module: "plateforme", path: "/editeur" },
      { key: "editorClinics", icon: <UsersIcon />, module: "plateforme", path: "/editeur/cliniques" },
      { key: "editorCampaigns", icon: <DocsIcon />, module: "plateforme", path: "/editeur/campagnes" },
      { key: "editorOffer", icon: <WalletIcon />, module: "plateforme", path: "/editeur/offre" },
    ],
  },
  {
    key: "pilotage",
    items: [
      { key: "overview", icon: <GridIcon />, module: "dashboard", path: "/" },
      { key: "approvals", icon: <DocsIcon />, module: "dashboard", path: "/aval" },
      { key: "help", icon: <GraduationIcon />, module: "dashboard", path: "/aide" },
    ],
  },
  {
    key: "agenda",
    items: [
      {
        key: "agenda",
        icon: <CalenderIcon />,
        module: "agenda",
        subItems: [
          { key: "agendaCalendar", path: "/agenda" },
          { key: "agendaQueue", path: "/agenda/file-attente" },
          { key: "agendaRequests", path: "/agenda/demandes" },
        ],
      },
    ],
  },
  {
    key: "clientele",
    items: [
      {
        key: "clients",
        icon: <UsersIcon />,
        module: "clients",
        subItems: [
          { key: "clientsPets", path: "/clients/compagnie" },
          { key: "clientsFarm", path: "/clients/eleveurs" },
          { key: "clientsList", path: "/clients" },
          { key: "clientsNew", path: "/clients/nouveau" },
          { key: "clientsMerge", path: "/clients/fusion" },
        ],
      },
      {
        key: "crm",
        icon: <ContactIcon />,
        module: "relation",
        subItems: [
          { key: "followup", path: "/relation-client/suivi" },
          { key: "tasks", path: "/relation-client" },
          { key: "reminders", path: "/relation-client/rappels" },
          { key: "interactions", path: "/relation-client/interactions" },
        ],
      },
    ],
  },
  {
    key: "clinique",
    items: [
      { key: "patients", icon: <PawIcon />, module: "patients", path: "/patients" },
      {
        key: "consultations",
        icon: <StethoscopeIcon />,
        module: "consultations",
        subItems: [
          { key: "consultationsList", path: "/consultations" },
          { key: "consultationsNew", path: "/consultations/nouvelle" },
          { key: "consultationsHome", path: "/consultations/domicile" },
          { key: "prescriptions", path: "/prescriptions", module: "prescriptions" },
        ],
      },
      { key: "hospitalization", icon: <BedIcon />, module: "hospitalisation", path: "/hospitalisation" },
      { key: "treatments", icon: <PillIcon />, module: "hospitalisation", path: "/traitements" },
    ],
  },
  {
    key: "prevention",
    items: [{ key: "prophylaxis", icon: <SyringeIcon />, module: "patients", orModule: "exploitations", path: "/prophylaxie" }],
  },
  {
    key: "rural",
    items: [
      { key: "farms", icon: <FarmIcon />, module: "exploitations", path: "/exploitations" },
      { key: "careFollowUp", icon: <PillIcon />, module: "exploitations", path: "/exploitations/suivi" },
      {
        key: "missions",
        icon: <TruckIcon />,
        module: "missions",
        subItems: [
          { key: "ruralVisits", path: "/missions" },
          { key: "ruralReports", path: "/missions/rapports" },
        ],
      },
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
          { key: "stockSale", path: "/stock/vente" },
          { key: "stockOverview", path: "/stock" },
          { key: "stockCatalog", path: "/stock/catalogue" },
          { key: "stockLots", path: "/stock/lots" },
          { key: "stockMovements", path: "/stock/mouvements" },
          { key: "stockInventories", path: "/stock/inventaires" },
          { key: "stockTransfers", path: "/stock/transferts" },
          { key: "stockDepots", path: "/stock/depots" },
          { key: "stockMolecules", path: "/stock/molecules" },
          { key: "stockDrugIndex", path: "/stock/index-therapeutique" },
          { key: "stockCalculator", path: "/stock/calculateur" },
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
          { key: "payables", path: "/achats/dettes" },
          { key: "forecast", path: "/achats/previsions" },
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
          { key: "fneInvoices", path: "/facturation/fne" },
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
          { key: "projects", path: "/finances/projets" },
          { key: "financeRevenue", path: "/finances/recettes" },
          { key: "cashBoxes", path: "/finances/caisses" },
          { key: "accounts", path: "/finances/comptes" },
          { key: "credits", path: "/finances/credits" },
          { key: "receivables", path: "/finances/creances" },
        ],
      },
      { key: "budgets", icon: <WalletIcon />, module: "dashboard", path: "/budgets" },
      { key: "equipment", icon: <BoxIcon />, module: "dashboard", path: "/materiel" },
      { key: "adminFiles", icon: <DocsIcon />, module: "documents", path: "/dossiers-admin" },
    ],
  },
  {
    key: "relation",
    items: [
      { key: "trainings", icon: <GraduationIcon />, module: "formations", path: "/formations" },
      { key: "equipe", icon: <UsersIcon />, module: "dashboard", path: "/equipe" },
      { key: "teamTasks", icon: <TaskIcon />, module: "dashboard", path: "/equipe/taches" },
      { key: "staffMgmt", icon: <ContactIcon />, module: "dashboard", path: "/personnel" },
      { key: "protocols", icon: <DocsIcon />, module: "dashboard", path: "/protocoles" },
      { key: "documents", icon: <DocsIcon />, module: "documents", path: "/documents" },
      {
        key: "reports",
        icon: <ChartBarIcon />,
        module: "rapports",
        subItems: [
          { key: "reportsMeeting", path: "/rapports/reunion" },
          { key: "reportsMargins", path: "/rapports/marges" },
          { key: "reportsRevenue", path: "/rapports/recettes" },
          { key: "reportsStats", path: "/rapports" },
        ],
      },
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
          { key: "categories", path: "/administration/categories" },
          { key: "establishments", path: "/administration/etablissements" },
          { key: "settings", path: "/administration/parametres" },
          { key: "announcements", path: "/administration/annonces" },
          { key: "alertSettings", path: "/administration/alertes" },
          { key: "licences", path: "/administration/licences" },
          { key: "audit", path: "/administration/journal" },
          { key: "demo", path: "/administration/demo" },
        ],
      },
    ],
  },
];

/** Second module qui ouvre aussi une route (entrée partagée entre compagnie et rente). */
export function altModuleForPath(pathname: string): ModuleId | null {
  for (const g of NAV_GROUPS)
    for (const it of g.items)
      if (it.orModule && it.path && (pathname === it.path || pathname.startsWith(`${it.path}/`))) return it.orModule;
  return null;
}

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
