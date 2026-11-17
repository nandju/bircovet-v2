# AUDIT CLIVA — lecture seule (16/11/2026)

Audit du dépôt en vue du branchement d'un backend NestJS + PostgreSQL, avec la stratégie
« services de `src/lib/services/` exécutés côté serveur (code partagé), exécution locale
optimiste côté navigateur, puis rechargement de l'état validé ».

Commandes réellement exécutées lors de l'audit : `npx tsc --noEmit` (0 erreur),
`npm run lint` (0 erreur, 16 avertissements), `npm run test:rules` (**57/57 réussis**).

---

## 1. Résumé exécutif

État général : **sain**. `tsc --noEmit` 0 erreur, lint 0 erreur (16 avertissements),
**57/57 tests** métier. Architecture services pure `(db, ctx, input)` réellement
respectée : aucun service ne lit le navigateur, aucun input non sérialisable.

**Verdict : la stratégie « mêmes services exécutés côté serveur » est faisable**, à
condition de corriger d'abord le non-déterminisme des identifiants.

5 risques principaux :

1. `uid()` non déterministe → ids divergents client/serveur ;
2. ~175 usages synchrones de `run()` → garder l'exécution optimiste locale est
   obligatoire pour ne pas réécrire les écrans ;
3. photos/justificatifs base64 dans l'état (quota, bande passante) ;
4. `demoPassword`, salaires et `platform` dans le même objet que le reste →
   filtrage serveur par rôle indispensable ;
5. `structuredClone` de ~800 Ko à chaque action + contexte global → à surveiller
   sur Android d'entrée de gamme.

---

## 2. Tableau des problèmes

| # | Gravité | Fichier:ligne | Problème | Correction proposée | Effort |
|---|---------|---------------|----------|---------------------|--------|
| 1 | **Bloquant** | `src/lib/format.ts:81-82` | `uid()` = `Date.now()+Math.random()` ; 174 appels dans les services → ids différents entre exécution navigateur et serveur | Générateur déterministe seedé par `opKey` passé dans `ctx` (ex. compteur + hash de `opKey`), `uid` lisant `ctx` | M |
| 2 | **Bloquant** | `src/lib/seed/index.ts:69`, `src/context/DemoStoreContext.tsx` | Pas de clé d'opération (`opKey`) systématique sur `run()` → pas d'idempotence ni de rejeu serveur | Générer un `opKey` unique par appel `run()` dans le contexte, transmis au serveur | M |
| 3 | Important | `src/lib/types.ts:180,849,1336` | Photos patients, logo, justificatifs en base64 **dans l'état** → gonfle chaque clone/sauvegarde/transfert | Extraire vers un stockage de fichiers (S3/local) côté backend ; l'état ne garde que des URLs | M |
| 4 | Important | `src/lib/types.ts:59` + `src/lib/seed/base.ts:80` | `demoPassword` en clair dans `users`, envoyé à tout client | Backend : hash serveur, jamais sérialisé vers le front | S |
| 5 | Important | `src/lib/types.ts:2067` | `platform` (console éditeur, finances des cliniques) dans le même `DemoDB` | Base/tenant séparé côté backend (déjà annoté dans le code) | M |
| 6 | Important | `src/lib/services/core.ts:20` | `structuredClone(db)` (~800 Ko) à chaque action ; re-rendu global du contexte | Acceptable au MVP ; sinon clonage sélectif des collections touchées | L |
| 7 | Important | `src/lib/services/aiService.ts:51` | `new Date()` au lieu de `ctx.now` → non déterministe | Remplacer par `today(ctx)` | S |
| 8 | Mineur | `src/lib/seed/index.ts` (1170 l.), `src/lib/types.ts` (2389 l.) | Fichiers très gros | Types : découper par domaine lors du passage monorepo | M |
| 9 | Mineur | `package.json` | `@fullcalendar/react`, `swiper`, `react-dnd`, `react-dropzone`, `@react-jvectormap/*` **non importés** dans `src` (hors `swiper/css` dans `layout.tsx:15` et overrides `globals.css`) ; `_template-archive/` conservé | Supprimables (gain d'installation/maintenance, pas de gain bundle car non importés) | S |
| 10 | Mineur | lint | 16 avertissements (directives eslint-disable inutilisées, etc.) | `lint --fix` | S |

---

## 3. Sections détaillées

### 3.1 Carte du projet

- **105 routes** `page.tsx` + **2 routes API** (`/api/assistant/chat`,
  `/api/assistant/transcribe`), **253 composants** `.tsx` dans plus de 40 dossiers de
  feature, **44 fichiers** de services exportant **325 opérations**
  (`export const/function`).
- **`src/lib` dépendant du navigateur** (vérifié un par un ; `help.ts`, `tutorials.ts`,
  `teamTasksService.ts` sont des **faux positifs** — le mot « document. » apparaît dans
  des phrases) :
  - `src/lib/branding.ts:86-107` — `document.documentElement/body` (application CSS).
    Séparable : le calcul de palette est pur, seule l'application est DOM.
  - `src/lib/miniMarc.ts:287-337` — `document.addEventListener`, suivi de champ actif.
    Front uniquement.
  - `src/lib/assistant/server.ts` — inverse : serveur uniquement (`process.env`).
  - `src/lib/xlsx.ts` : **aucune** API navigateur — portable Node.
  - **Aucun** fichier de `src/lib/services/` ni `src/lib/seed/` n'importe React,
    `next/*`, composants ou contextes. ✅
- **Héritage template** : `_template-archive/` (app-admin, app-full, components,
  messages…) toujours présent ; dépendances fantômes listées au tableau (#9) ;
  `flatpickr` **encore utilisé** (`src/components/form/date-picker.tsx:3`),
  `simplebar-react` importé en CSS (`src/app/[locale]/layout.tsx:14`).

### 3.2 Faisabilité de l'exécution des services côté serveur

- **a. Déterminisme** : seul vrai bloquant. `uid()` (`src/lib/format.ts:81-82`) :
  174 appels dans les services. `new Date()`/`Date.now()` hors `ctx.now` :
  `format.ts:47,55,60` (valeurs par défaut de fonctions utilitaires — appelées avec
  argument dans les services), `seed/index.ts:69` (seed, OK), `aiService.ts:51`
  (**à corriger**), `assistant/server.ts:88` (rate limiting serveur, OK).
  Correction minimale : `ctx.ids = makeIdGen(opKey)` et `uid` dérivé — aucune
  signature de service ne change.
- **b. Dépendances implicites** : aucune trouvée — les services ne lisent que
  `(db, ctx, input)`. Seule nuance : `applyRoleSettings`
  (`src/context/DemoStoreContext.tsx:222`) mute un état module-global de
  `permissions.ts` que `requireRole` ne consulte pas (il lit `ctx.user.roleId`) —
  mais `can()` oui : le serveur devra appliquer la matrice depuis
  `db.settings.permissions`, pas depuis l'état module.
- **c. Sérialisation** : aucun `File`/`Blob`/`Map`/fonction dans les inputs (vérifié
  par recherche) ; dates = chaînes ISO. Exceptions à signaler : photos/justificatifs
  passés en **data URL base64** (chaînes JSON valides mais lourdes) et imports Excel
  déjà convertis en objets avant d'atteindre le service. ✅
- **d. Taille** : `createSeed()` v23 = **797 Ko** JSON (mesuré) ; plus gros :
  consultations 205 Ko, invoices 149 Ko, payments 67 Ko. Croissance bornée :
  audit ≤ 800 (`core.ts:55`), notifications ≤ 100 (`core.ts:60`). **Non borné** :
  photos patients (compressées ~100-200 Ko pièce, mais cumulatives), justificatifs
  ≤ 800 Ko pièce → à sortir de l'état (tableau #3).
- **e. `run()` synchrone** : **~175 usages** mesurés (`= run(` / `run(...).ok`) —
  proche des 168 annoncés, l'écart vient du motif de comptage. **Oui**, garder `run`
  synchrone (application locale optimiste + envoi `{serviceKey, opKey, input}` au
  serveur + rechargement de l'état validé) évite de toucher aux ~175 sites. Les ids
  étant déterministes après correction #1, l'état local et serveur convergent.
- **f. Hors ligne** : `queueIfOffline` (`src/lib/services/syncService.ts:9`) n'enfile
  que 3 types d'opérations (notes client/patient, rapport de mission) avec
  anti-doublon par `opKey` ; `synchronize` est idempotente et gère les conflits
  simulés. `requireOnline` bloque déjà 11 opérations sensibles : vente au comptoir,
  validation de facture, avoir, validation clinique, décisions financières (x3),
  crédit, fusion de clients, cession de propriété, ajustements de stock (x2),
  politique financière. Bon modèle pour le backend.

### 3.3 Sécurité et données sensibles

- **Contrôles de rôle** : **75 `requireRole`** dans 15 services — c'est la matrice que
  l'API devra rejouer. Détail par service (fichier : lignes → rôles exigés) :
  - `inventoryService.ts` : 64 (dg, vet, assistant, accueil — statut de lot),
    90 (**dg** — correction de stock), 205 (**dg** — validation d'inventaire)
  - `hospitalizationsService.ts` : 23, 77, 134 (dg, vet), 95 (dg, vet, assistant),
    165 (dg, vet, accueil — préfacturation)
  - `trainingsService.ts` : 19 (dg, accueil)
  - `financesService.ts` : 10, 84 (dg, accueil) ; 56, 71, 113, 129, 140, 153 (**dg** —
    validation de dépense, transfert, crédit, soldes, comptes)
  - `projectsService.ts` : 10, 33, 49, 67 (dg, accueil, comptable)
  - `cashBoxService.ts` : 15 (**dg** — création des caisses), 33/67/77 (tous rôles)
  - `drugIndexService.ts` : 31, 54, 73 (rôles d'édition), 83 (**dg** — suppression)
  - `prescriptionsService.ts` : 19, 54 (dg, vet) ; 100, 121, 132 (validateurs
    cliniques) ; 150 (dg, vet, assistant, accueil — délivrance)
  - `careService.ts` : 10, 48, 120 (rôles métier), 97 (dg, vet, assistant, accueil)
  - `suppliersService.ts` : 33, 46, 92 (dg, accueil, assistant) ; 69, 130 (dg, accueil)
  - `counterSaleService.ts` : 48 (dg, vet, accueil, assistant)
  - `consultationsService.ts` : 66, 86 (validateurs cliniques), 127 (**dg** —
    approbation), 141 (dg, vet)
  - `patientsService.ts` : 67 (dg, vet, assistant — vaccination), 111 (dg, vet — décès)
  - `prophylaxisService.ts` : 27, 49, 153, 237 (édition) ; 75, 119, 187, 212, 225
    (application/suivi)
  - `adminService.ts` : 28, 40, 52, 63, 73, 83, 130, 145, 165 (**dg** — tout
    l'administratif)
  - `invoicesService.ts` : 110, 224, 246 (dg, vet, accueil) ; 138, 180, 275 (dg,
    accueil — validation, avoir, conversion pro forma)

  S'y ajoutent les `can()` d'affichage (front seulement, non probants côté sécurité).
- **Données à ne jamais envoyer selon le rôle** :
  - `users[].demoPassword` (`types.ts:59`, lu par `SignInForm`/
    `DemoStoreContext.tsx:218`) ;
  - salaires/charges (`src/lib/staff.ts`, lus par `MarginsParts.tsx:126`,
    `ReportsPage.tsx:77,149`, `FinanceOverview.tsx:35`, `DashboardCharts.tsx:74` —
    réservés DG/comptable) ;
  - `platform` entier (`types.ts:2067` — console éditeur : finances de toutes les
    cliniques, lu par `src/components/platform/*`) ;
  - résultats financiers consolidés (module `rapports`, filtré par `can("rapports")`
    côté front uniquement aujourd'hui).
- **Opérations à ne jamais exposer par l'API clinique** :
  - `resetDemo`/`switchUser` : client seul (`DemoStoreContext.tsx:237,249`) —
    n'existent pas comme services ✅ ;
  - les opérations de `platformService.ts` réservées à l'éditeur : `saveClinic`,
    `recordPlatformPayment`, `setClinicStatus`, `saveCampaign`, `deleteCampaign`,
    `saveOffer` — seul `trackCampaign` est appelable par une clinique ;
  - `simulateRemoteConflict` (`syncService.ts:32`, outil de démo).
- **Secrets** : `.env.example` propre (`GEMINI_API_KEY=` vide, vérifié), aucun motif
  de clé (`AIza…`, `sk-…`, `AQ.…`) dans `src/`, aucun `NEXT_PUBLIC_` sensible.
  La clé Gemini est serveur-seul (`src/lib/assistant/server.ts`). ✅

### 3.4 Qualité et dette technique

- **Commandes exécutées réellement** : `npx tsc --noEmit` → 0 erreur ·
  `npm run lint` → 0 erreur, 16 avertissements · `npm run test:rules` →
  **« 57 test(s) réussi(s), 0 échec(s) »** (la bonne réponse aux « 52/57/67 »
  est **57**).
- **Migrations v5→v23** : toutes encore actives dans `upgrade()`
  (`DemoStoreContext.tsx:85-106`) pour les navigateurs ayant d'anciennes données.
  **Une base neuve part directement du schéma v23** via `createSeed()` — en
  production PostgreSQL, les 18 fichiers `migrateV*.ts` sont inutiles (le schéma SQL
  démarre à l'équivalent v23) et resteront front-seulement le temps de la démo.
- **Gros fichiers** (> 600 l.) : `types.ts` (2389), `seed/index.ts` (1170) — les
  composants plafonnent à 488 l. (`DoseCalculator.tsx`). Hors MVP à masquer par
  réglage menu + permissions (missions, formations, équipement, projets, budgets,
  forecast, hospitalisation selon le périmètre retenu…) : déjà possible via
  `db.settings.permissions` sans suppression.
- **Performances Android entrée de gamme** : `structuredClone` de ~800 Ko par action
  (`core.ts:20`) ≈ quelques ms sur mobile moderne, sensible sur entrée de gamme si
  photos dans l'état (d'où #3) ; tout `run()` re-rend tous les consommateurs du
  contexte (pas de sélecteurs) ; bundle : les grosses libs (ApexCharts,
  FullCalendar…) sont en import dynamique — correct.

### 3.5 Préparation de l'architecture cible (monorepo pnpm)

- Découpe : `apps/web` (ce Next.js) · `apps/api` (NestJS) · `packages/core`.
- **À déplacer dans `packages/core`** : `types.ts`, `format.ts` (après correction
  uid), `calc.ts`, `permissions.ts`, `labels.ts`, `vitals.ts`, `drugIndex.ts`,
  `prophylaxis.ts`, `care.ts`, `rural.ts`, `revenue.ts`/`revenueHelpers.ts`,
  `margins.ts`, `payables.ts`, `seed/`, `services/` (44 fichiers), `followup.ts`,
  `pharma/`, `alerts.ts`, `notifications.ts`, `xlsx.ts`.
- **Restent dans le front** : `branding.ts` (partie DOM), `miniMarc.ts`,
  `assistant/` (routes serveur Next), `help.ts`, `tutorials.ts`, `worldDays.ts`,
  `migrateV*.ts`.
- Imports `@/lib/...` conservés : alias tsconfig
  `"@/lib/*": ["../../packages/core/src/*"]` + `transpilePackages: ["@cliva/core"]`
  dans `next.config.ts` — zéro changement dans les 253 composants.
- **Collections MVP** : users, roles/settings, establishments, clients, patients,
  appointments, queue, consultations, prescriptions, deliveries, farms, lots
  (élevage), care/prises en charge, prophylaxis*, products, stockLots, movements,
  counterSales, drugIndex, invoices, payments, cashboxes, expenses, accounts,
  counters, audit, notifications.
- **Hors MVP** : missions, trainings, equipment, projects, budgets, forecast,
  hospitalizations, consignments, followUps (selon arbitrage), platform, adminFiles,
  teamTasks, meetings, tutorials, syncQueue (remplacé par le vrai offline).

---

## 4. Corrections ordonnées AVANT le backend

1. **Ids déterministes** : `opKey` généré par `run()`, générateur d'ids seedé dans
   `ctx`, remplacer les appels directs à `uid()` dans les services (#1, #2).
2. `aiService.ts:51` → `today(ctx)` (#7).
3. Sortir photos/justificatifs de l'état (contrat : champ URL, stockage fichier côté
   API) (#3).
4. Faire lire `can()` serveur depuis `db.settings.permissions` (pas d'état module)
   (§3.2.b).
5. Marquer les services « non exposables » (platformService sauf `trackCampaign`,
   `simulateRemoteConflict`) par une liste d'exclusion dans le futur contrôleur.
6. Nettoyage : dépendances fantômes + `_template-archive` + `lint --fix` (#9, #10).

**Non vérifié** : comportement réel sur un téléphone Android d'entrée de gamme
(estimation raisonnée uniquement) ; taille exacte du bundle par page.
