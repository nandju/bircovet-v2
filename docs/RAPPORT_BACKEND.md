# Rapport de vérification — Monorepo Cliva (backend + branchement front)

Date : 18/11/2026 · Commit de référence : `bf425c3` (branche `main`) · Environnement : Windows / PowerShell, Node v22.14.0, pnpm 10.7.0.

Méthode : lecture seule du dépôt + exécution des commandes de vérification. Aucun fichier n'a été modifié hormis ce rapport. Aucune valeur de `.env` ni adresse de base de données n'est reproduite ci-dessous : seuls les noms de variables et leur état « remplie / vide » sont indiqués.

---

## 1. État général

### Git

`git log --oneline -20` :

```
bf425c3 feat(web): branche DemoStoreContext sur l'API quand NEXT_PUBLIC_API_URL est définie
d5e8539 Modules state + ops : lecture filtrée et écriture idempotente
17786a1 Module auth de l'API : login JWT + refresh httpOnly + e2e
7df773e API NestJS + Prisma/Neon : socle backend du monorepo
aea3245 Prompt 1 : corrections de l'audit
e479d8b Démo Cliva avant backend
4f90e7f Cliva: corrections Mini Marc ...
bcaf47a mini ia prêt ...
de8e3ad reste à rendre l'ia fonctionnelle
aaa25a9 chore: initial commit
```

`git status --short` : **arbre propre**, aucun fichier non commité (sortie vide).

### Arborescence (3 niveaux, hors node_modules/.next/dist)

```
.                          ← le front Next.js VIT ICI (racine), pas dans apps/web
├── apps/
│   └── api/               ← pas de apps/web : seul l'API est un paquet séparé
│       ├── prisma/        (schema.prisma, migrations/, seed.ts)
│       ├── src/           (main.ts, app.module.ts, app.setup.ts, auth/, config/,
│       │                   generated/, health/, ops/, prisma/, state/)
│       ├── test/          (auth.e2e-spec.ts, state-ops.e2e-spec.ts, jest-e2e.json)
│       ├── package.json, tsconfig.json, tsup.config.ts, prisma.config.ts
├── packages/
│   └── core/
│       ├── package.json   (@cliva/core)
│       └── src/index.ts   (ré-exports de src/lib — aucun code dupliqué)
├── docs/                  (AUDIT.md, RAPPORT_BACKEND.md…)
├── src/                   (le front : app/, components/, context/, lib/…)
├── scripts/               (test-business-rules.ts…)
└── public/
```

**Écart à signaler** : le dossier `apps/web` demandé n'existe pas — le front reste à la racine du dépôt (`src/`). Toute référence à « apps/web » dans les prompts s'applique donc à la racine (`src/lib/api.ts`, `.env.local` racine, `pnpm build` racine). `pnpm --filter web …` ne correspond à aucun projet :

```
$ pnpm --filter web build
No projects matched the filters in "C:\dr_marc_herve\bircovet\free-nextjs-admin-dashboard-main"
```

### Versions (package.json + pnpm-lock.yaml)

| Outil | Déclaré | Résolu (lockfile) |
|---|---|---|
| Node | ≥ 20.9 | v22.14.0 |
| pnpm | — | 10.7.0 |
| Next.js | `^16.3.4` | **16.4.0** |
| React | `^19.2.8` | 19.3.0 |
| NestJS (`@nestjs/core`) | `^11.1.9` | 11.2.10 |
| Prisma / `@prisma/client` | `^7.10.1` / `7.10.1` | 7.10.1 |
| TypeScript | `^5.9.3` | 5.9.3 |
| `@nestjs/jwt` | `^11.0.2` | 11.0.2 (v12 = ESM-only, évitée volontairement) |

### Divers

- `app/` à la racine : **absent** (`ls -d app` → « pas de dossier app/ racine » ; l'App Router est dans `src/app/`).
- `package-lock.json` : **absent** — le projet est passé à pnpm (`pnpm-lock.yaml` présent).
- `.env` commités ? `git ls-files | grep "\.env"` :
  ```
  .env.example
  .env.local.example
  apps/api/.env.example
  ```
  → seuls des fichiers d'exemple sont suivis. `.gitignore:30-34` couvre `.env` et `.env.*` avec exceptions `!.env.example` et `!.env.local.example`. `.env.local` et `apps/api/.env` sont bien ignorés.

### Variables d'environnement (noms + état uniquement)

| Fichier | Variables | État |
|---|---|---|
| `.env.local` | `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TRANSCRIBE_MODEL`, `NEXT_PUBLIC_API_URL` | toutes **remplies** |
| `apps/api/.env` | `DATABASE_URL`, `DIRECT_URL`, `DATABASE_URL_TEST`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `SEED_PASSWORD` | toutes **remplies** |
| `apps/api/.env.example` | les 7 mêmes | vides sauf `CORS_ORIGIN` |
| `.env.local.example` | `NEXT_PUBLIC_API_URL` | remplie (valeur publique `http://localhost:3001/api`) |

---

## 2. Prompt 1 : corrections de l'audit

### `ActionCtx.opKey`

`src/lib/types.ts:2103-2110` :

```ts
export interface ActionCtx {
  user: User;
  establishmentId: ID;
  offline: boolean;
  now: ISODate;
  /** Clé unique de l'opération : idempotence + identifiants déterministes … */
  opKey: string;
}
```

### Générateur d'ids déterministe

`src/lib/services/core.ts:19-28` — `executeService` installe une fabrique d'ids dérivée de `opKey` :

```ts
export function executeService<I, T = undefined>(svc, db, ctx, input): ServiceResult<T> {
  const short = ctx.opKey.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "op";
  let counter = 0;
  setUidFactory((prefix) => `${prefix}-${short}-${++counter}`);
  try { return svc(db, ctx, input); } finally { setUidFactory(null); }
}
```

`src/lib/format.ts:85-91` — `uid()` délègue à la fabrique quand elle est installée :

```ts
let uidFactory: ((prefix: string) => string) | null = null;
export function setUidFactory(f: ((prefix: string) => string) | null) { uidFactory = f; }
export function uid(prefix = "id"): string {
  if (uidFactory) return uidFactory(prefix);
```

### `Date.now()` / `new Date()` / `Math.random()` dans les services

Recherche dans `src/lib/services/` (le code métier réel — `packages/core/src/services` n'existe pas, `@cliva/core` ré-exporte `src/lib`, cf. §3) :

```
src/lib/services/aiService.ts:51:  const today = todayIso ?? new Date().toISOString().slice(0, 10);
```

→ **1 seule occurrence**, un repli quand le paramètre `todayIso` n'est pas fourni ; `aiService` n'est pas dans le registre `OPERATIONS` (donc jamais exécuté côté serveur). Acceptable mais à noter. Aucun `Date.now()` ni `Math.random()` dans les services.

### `canWith`

`src/lib/permissions.ts:203-216` — version pure de `can()` : prend la matrice en paramètre, aucun état de module lu (commentaire : « sans AUCUN état de module — le serveur l'appelle avec db.settings.permissions »).

### Registre `OPERATIONS`

`src/lib/services/registry.ts` : **134 opérations** (`grep -c 'op(\w+,'` = 134), regroupées par domaine (agenda, clients, patients, consultations, ordonnances, prophylaxie, exploitations, stock, facturation, finances, admin, annonces).

- **platformService** : seul `trackCampaign` importé (`registry.ts:59`), enregistré sous `"annonces.comptage"` (`registry.ts:237`). Conforme au commentaire `registry.ts:10-14` qui interdit explicitement le reste de platformService, `simulateRemoteConflict`, `synchronize`, `resolveConflict`, `clearSynced`, `restoreBackup`.
- **Opérations appelées par les écrans hors registre** : analyse statique de tous les `run(<service>, …)` dans `src/` — **262 services distincts** appelés, dont **135 absents du registre**. En mode API, ces 135 mutations s'exécutent localement puis sont ignorées par l'envoi (avertissement console en dev, `DemoStoreContext.tsx:358-361`) : elles ne seront **jamais persistées côté serveur**. Exemples : hospitalisation (`admitPatient`, `dischargePatient`, `invoiceStay`…), missions (`createMission`, `saveMissionReport`…), achats (`createSupplier`, `createPurchaseOrder`, `validateReception`…), CRM (`createProspect`, `logInteraction`…), équipe (`requestLeave`, `createMeeting`…), budgets, documents, formations. Le registre est déclaré « périmètre MVP » (`registry.ts:2`) — c'est volontaire, mais c'est l'écart le plus important avant un test réel.

### Test de déterminisme

`scripts/test-business-rules.ts:880-895` : exécute `createClient`, `counterSale`, `createPrescriptionOrder` deux fois avec le même `opKey`/`now` et vérifie `JSON.stringify(r1) === JSON.stringify(r2)`. **Passe** (sortie §6 : `✔ Déterminisme : même opKey + même now ⇒ résultats strictement identiques`).

---

## 3. Prompt 2 : monorepo

- `pnpm-workspace.yaml` : `packages: ["apps/*", "packages/*"]` + `onlyBuiltDependencies` (`@prisma/engines`, `esbuild`, `prisma`) pour autoriser les post-install bloqués par pnpm.
- `package.json` racine : scripts `dev`, `dev:api` (`pnpm --filter api dev`), `build`, `start`, `lint`, `test:rules`.
- `packages/core/package.json` : `"name": "@cliva/core"`, `"main": "./src/index.ts"`, `"exports": {".": "./src/index.ts", "./*": "./src/*"}` — **pas de scripts** (`test:rules` n'existe pas dans ce paquet ; la commande demandée `pnpm --filter @cliva/core test:rules` répond `None of the selected packages has a "test:rules" script` — le script vit à la racine).
- `packages/core/src/` ne contient **que `index.ts`**, qui ré-exporte `src/lib/{types, seed, permissions, redact, format, services/core, services/registry}` (`packages/core/src/index.ts:9-19`). Le code métier n'est **pas déplacé** physiquement — étape ultérieure annoncée (AUDIT §3.5).
- Résolution des imports `@/lib/...` : `tsconfig.json` racine → `"paths": {"@/*": ["./src/*"]}` ; `turbopack.root: __dirname` dans `next.config.ts`. Pas de `transpilePackages` : le front n'importe pas `@cliva/core` (il lit `src/lib` directement) ; seule l'API l'importe, avec `tsconfig` adapté et bundling tsup.
- `tsconfig.json` racine exclut `"apps"` et `"packages"` (typechecks séparés).

---

## 4. Prompts 3 à 5 : API NestJS

### Routes (préfixe global `/api`, `app.setup.ts:20`)

| Méthode | Chemin | Accès | Preuve |
|---|---|---|---|
| GET | `/api/health` | **Publique** (`@Public()`) | `health.controller.ts:13` |
| POST | `/api/auth/login` | **Publique** + throttler 20/min/IP | `auth.controller.ts:36-41` |
| POST | `/api/auth/refresh` | **Publique** | `auth.controller.ts:51-53` |
| POST | `/api/auth/logout` | Protégée | `auth.controller.ts:62-68` |
| GET | `/api/auth/me` | Protégée | `auth.controller.ts:71-73` |
| POST | `/api/auth/change-password` | Protégée | `auth.controller.ts:76-81` |
| GET | `/api/state` | Protégée | `state.controller.ts:25-29` |
| GET | `/api/state/version` | Protégée | `state.controller.ts:33-37` |
| POST | `/api/ops` | Protégée | `ops.controller.ts:20-24` |

Seules 3 `@Public()` dans tout `src/` (hors généré) : health, login, refresh — confirmé par `grep -rn "@Public" apps/api/src`.

### Schéma Prisma et migrations

`apps/api/prisma/schema.prisma` : 5 modèles conformes à la demande — `Clinic` (`@@map("clinics")`), `Account` (`@@unique([clinicId, userId])`, `@@map("accounts")`), `ClinicState` (PK `clinic_id`, `data Json`, `@@map("clinic_states")`), `Operation` (`@@unique([clinicId, opKey])`, enum `OperationStatus {ok, refused}`, `@@map("operations")`), `RefreshToken` (`@@map("refresh_tokens")`). Toutes les tables/colonnes en snake_case.

Migrations : `prisma/migrations/20261117204103_init/migration.sql` (1 migration) + `migration_lock.toml`.

⚠️ **État d'application** : `pnpm exec prisma migrate status` sur `DIRECT_URL` →

```
1 migration found in prisma/migrations
Following migration have not yet been applied:
20261117204103_init
```

→ La base principale (`DATABASE_URL`) **n'a pas les tables** ; c'est exactement l'erreur `P2021 The table 'public.accounts' does not exist` observée dans les journaux du `pnpm dev:api` lancé manuellement. En revanche `cliva_test` est à jour (les e2e appliquent les migrations, cf. sortie §6 « No pending migrations to apply »).

### Configuration Neon

- Application : `PrismaService` (`apps/api/src/prisma/prisma.service.ts:13`) → `new PrismaNeon({ connectionString: env("DATABASE_URL") })` — connexion **pooled**, paresseuse (pas de `$connect()` au boot : l'API démarre même si la base est injoignable, `prisma.service.ts:16-18`).
- CLI/migrations : `prisma.config.ts:19` → `datasource.url = process.env.DIRECT_URL` — connexion **directe** (doc officielle Prisma 7 + Neon).

### Validation des variables au démarrage

`apps/api/src/config/env.ts:7-15` liste les 7 variables exigées ; `validateEnv()` (`env.ts:20-29`) est appelée en premier dans `main.ts:13` et **refuse le démarrage** en n'affichant que les noms manquants. Vérifié au démarrage réel : `API Cliva démarrée sur http://localhost:3001/api (schéma métier v23)`.

### Authentification

- **Hachage** : `@node-rs/argon2` (`auth.service.ts:7`, `hash`/`verify`) ; refresh token = 48 octets aléatoires base64url, seul le **SHA-256** est stocké (`auth.service.ts:93-99`, `hashToken` `:163-165`).
- **Jeton d'accès** : JWT 15 min, payload `{sub: accountId, clinicId, userId, roleId}` (`auth.service.ts:19`, `:86-89`).
- **Cookie refresh** : `cliva_refresh`, `httpOnly`, `sameSite: "lax"`, `secure` en production, `maxAge` 30 j, `path: "/api/auth"` (`auth.controller.ts:26-34`).
- **Blocage** : 5 échecs → `lockedUntil = now + 15 min` (`auth.service.ts:17-18`, `:56-66`) ; remise à zéro au succès (`:70-73`).
- **Erreur uniforme** : `INVALID_CREDENTIALS = "Email ou mot de passe incorrect"` pour email inconnu, mdp faux, inactif, bloqué (`auth.service.ts:15`, `:45-53`).
- **Throttler** : `ThrottlerModule` mémoire 100 req/min global (`auth.module.ts:17`) + `@Throttle({limit: 20, ttl: 60_000})` sur login (`auth.controller.ts:37-39`).
- **Rotation** : `refresh()` révoque l'ancien jeton puis en émet un nouveau (`auth.service.ts:106-123`) ; `logout()` révoque (`:127-133`) ; `changePassword()` vérifie l'ancien mdp, impose ≥ 10 car. (DTO), remet `mustChangePassword=false` et **révoque toutes les sessions** (`:144-160`).

### Guard global

`JwtAuthGuard` enregistré en `APP_GUARD` (`auth.module.ts:22`) : vérifie le `Bearer` sauf routes `@Public()` (`jwt-auth.guard.ts:29-56`), injecte `request.user = {accountId, clinicId, userId, roleId}` depuis le payload.

### POST /api/ops — code vérifié en entier

`ops.controller.ts` (25 lignes) et `ops.service.ts` (137 lignes) lus intégralement. Étapes réelles du code :

1. Idempotence : `operation.findUnique({clinicId_opKey})` → réponse rejouée `replayed: true` sans réexécution (`ops.service.ts:38-49`).
2. `OPERATIONS[dto.name]` sinon `BadRequestException` (`:51-53`).
3. `canWith(data.settings?.permissions, user.roleId, def.module, def.action)` sinon 403 (`:64-68`).
4. Transaction : `SELECT data, version FROM clinic_states WHERE clinic_id = $1::uuid FOR UPDATE` (`:74-76`), re-lecture du user et **re-vérification canWith sur l'état verrouillé** (`:81-86`), construction `ctx = {user, establishmentId, offline:false, now: serverNowIso(), opKey}` (`:89-95`), `executeService` (`:100-105`).
5. ok → `data + version+1 + Operation(status:"ok")` (`:116-128`) ; refus → `Operation(status:"refused", error)` sans toucher l'état (`:130-134`).
6. Réponse `{ok, version, message?, data?, error?, replayed?}`.

### `redactForRole`

`src/lib/redact.ts:34-60` — retire : `platform` (toujours), tout `demoPassword` (récursif via `stripDemoPasswords:20-31`), `salaries` + `budgets` sauf si `canWith(…, "salaires", "read")`, et pour `roleId === "confrere"` ne garde que `sharedPatientIds`. Testée dans `test-business-rules.ts:897-919` (DG conserve les salaires ; assistant/comptable non ; permissions DG ouvrant le module) — passe, 59/59.

### `clinicId` toujours issu du jeton ?

`grep "clinicId" apps/api/src` (hors `generated/`) : toutes les utilisations lisent `auth.clinicId` (=`@CurrentUser()`, payload JWT) ou écrivent le payload (`auth.service.ts:87`). `OpDto` ne contient pas `clinicId` (`ops.dto.ts:4-19`). **Aucune lecture depuis body/params/query.** ✅

### Seed

`apps/api/prisma/seed.ts` : `stripDemoPasswords` récursif (`:26-37`) appliqué à `createSeed(new Date())` (`:64`) ; clinique `upsert` sur UUID fixe (`:51-60`) ; `clinicState.upsert` (`:65-74`) ; un `account.upsert` par user sur `(clinicId, userId)` (`:82-96`) avec `mustChangePassword: true` et hash Argon2 de `SEED_PASSWORD` calculé une fois (`:80`). **Relançable sans doublon** (upserts partout). NON VÉRIFIÉ en exécution sur la base principale (migration non appliquée, cf. §7).

---

## 5. Prompt 6 : branchement du front

(« apps/web » = racine, cf. §1.)

### `src/lib/api.ts`

- Jeton d'accès : variable de module `let accessToken` (`api.ts:16`) — **mémoire uniquement**. `grep "localStorage|sessionStorage" src/lib/api.ts` → aucun accès (hors commentaires).
- `credentials: "include"` sur toutes les requêtes (`api.ts:60`).
- 401 → `apiRefresh()` → **une seule** reprise (`api.ts:70-73` ; `retry=false` au second appel). Refresh dédupliqué via `refreshing` (`:22-39`).
- `apiLogin` désactive le retry (`:107`) ; `apiLogout` appelle `/auth/logout` puis purge `:117-124`.

### `DemoStoreContext.tsx`

- `run()` **synchrone**, même signature/`ServiceResult` (`:336-367`) : `executeService` local avec `opKey` (`:344-348`), `persist()` immédiat (`:350`).
- File : `queueRef.push({opKey, name, input, clientNow})` (`:356`), `pumpQueue()` envoie **une à la fois dans l'ordre** (`:205-246`) : ok+version avancée → `reloadState()` quand file vide (`:216-221`) ; refus → toast + `reloadState()` (`:222-226`) ; `ApiNetworkError` → file conservée, toast « Envoi en attente », réessai 5 s (`:228-235`) ; erreur HTTP → dépilée + resynchro (`:237-241`). Op hors registre → `console.warn` dev-only (`:358-361`).
- Sondage : `setInterval` 10 s + `visibilitychange`, `GET /state/version`, rechargement seulement si file vide (`:305-328`).
- Bootstrap : `apiRefresh → apiMe → apiGetState` (`:249-271`) ; échec → seed local éphémère + écran de connexion. `mustChangePassword` → `ChangePasswordScreen` bloquant (`:454-456`).
- Mode démo : `persist()`/`saveSession()` court-circuitent localStorage quand `apiMode` (`:162`, `:178`) — sinon comportement identique (mêmes clés, même `storage` listener `:283-299`).

### Composants d'écran modifiés ?

`git diff d5e8539..HEAD --stat -- src/components` :

```
src/components/admin/DemoPage.tsx            | 11 ++---
src/components/auth/ChangePasswordScreen.tsx | 63 ++++++ (nouveau)
src/components/auth/SignInForm.tsx           | 14 +++---
src/components/header/UserDropdown.tsx       |  7 ++--
```

→ **3 écrans modifiés + 1 nouveau**, contrairement à « ne modifie AUCUN composant d'écran ». Modifications minimales et conditionnelles (`{!apiMode && …}` : bloc profils démo/mdp dans `SignInForm`, « Changer de profil » dans `UserDropdown`, « Se connecter en tant que… »/mdp démo/réinitialisation dans `DemoPage`) — requis par le point 5 de la demande, mais à signaler honnêtement. Aucun changement de rendu en mode démo.

### `NEXT_PUBLIC_API_URL` non définie ?

`apiMode = API_URL.length > 0` (`api.ts:11-13`) ; sans la variable : bootstrap `useEffect` exécute la branche `loadDb()`/`loadSession()` localStorage (`:276-301`), `login()` compare `demoPassword` (`:389-393`), `run()` n'empile rien. Mode démo **conservé à l'identique** ✅.

---

## 6. Commandes et sorties réelles

```
$ pnpm install
Scope: all 3 workspace projects
Lockfile is up to date, resolution step is skipped
Done in 2.1s using pnpm v10.7.0

$ pnpm --filter @cliva/core test:rules
None of the selected packages has a "test:rules" script     ← script inexistant dans ce paquet

$ pnpm test:rules          (script racine)
…
✔ Déterminisme : même opKey + même now ⇒ résultats strictement identiques
✔ redactForRole : platform/demoPassword toujours retirés, salaires selon le rôle
59 test(s) réussi(s), 0 échec(s).

$ tsc --noEmit (racine = front)        → exit 0, aucune erreur
$ tsc --noEmit (apps/api)              → exit 0, aucune erreur
$ tsc --noEmit (packages/core)         → exit 0, aucune erreur

$ pnpm lint (racine, eslint .)         → exit 0 : 0 erreur, 0 avertissement
lint apps/api                          → NON CONFIGURÉ (eslint.config.mjs:18 ignore "apps/**",
                                         aucun script lint dans apps/api/package.json)

$ pnpm --filter web build
No projects matched the filters …      ← apps/web n'existe pas (front = racine)

$ pnpm build (racine)
▲ Next.js 16.4.0 (Turbopack)
✓ Compiled successfully in 2.3s
  Finished TypeScript in 3.2s
✓ Generating static pages using 7 workers (93/93) in 1875ms
(⚠ rappel de vulnérabilité connue Next.js affiché par le CLI)

$ pnpm --filter api build
ESM dist\main.js 747.63 KB   ⚡️ Build success in 330ms

$ pnpm --filter api test:e2e
Datasource "db": PostgreSQL database "cliva_test" … at …neon.tech
No pending migrations to apply.
Test Suites: 2 passed, 2 total
Tests:       12 passed, 12 total
Time:        47.539 s
```

**Compteurs** : tests métier 59/59 · e2e 12/12 · tsc 0 erreur ×3 · lint 0 erreur / 0 avertissement (front seul) · builds OK ×2.

---

## 7. Synthèse

### 7.1 Tableau des exigences

| Exigence | Statut | Preuve |
|---|---|---|
| ids déterministes (opKey) | ✅ fait | `services/core.ts:19-28`, `format.ts:85-91`, test :880-895 |
| registre `OPERATIONS` | ⚠️ partiel | `registry.ts` (134 ops) mais **135 services d'écran non enregistrés** |
| monorepo | ⚠️ partiel | `pnpm-workspace.yaml`, `apps/api`, `packages/core` OK — **mais `apps/web` inexistant** (front racine), `@cliva/core` ré-exporte `src/lib` au lieu d'héberger le code |
| API qui démarre | ✅ fait | log réel : `API Cliva démarrée sur http://localhost:3001/api (schéma métier v23)` |
| `/api/health` | ✅ fait | `health.controller.ts:13-21` (`SELECT 1`, 503 sinon) |
| tables Neon | ⚠️ partiel | Schéma + migration présents ; **non appliqués sur `DATABASE_URL`** (P2021 réel), appliqués sur `cliva_test` |
| seed | ✅ fait | `seed.ts` (idempotent, demoPassword retirés) — NON VÉRIFIÉ en exécution (bloqué par la migration absente) |
| login + blocage | ✅ fait | `auth.service.ts:40-76` (Argon2, 5 échecs → 15 min), testé e2e |
| refresh/logout | ✅ fait | `auth.service.ts:106-133`, cookie httpOnly `auth.controller.ts:26-34`, testé e2e |
| change-password | ✅ fait | `auth.service.ts:144-160` (+ révocation des sessions), testé e2e |
| guard global | ✅ fait | `APP_GUARD` `auth.module.ts:22`, `jwt-auth.guard.ts:29-56`, 3 routes `@Public()` |
| `/state` filtré par rôle | ✅ fait | `state.controller.ts:25-29` + `redact.ts:34-60`, testé e2e |
| `/ops` idempotent | ✅ fait | `ops.service.ts:38-49` + `@@unique([clinicId, opKey])`, testé e2e |
| droits serveur (canWith) | ✅ fait | `ops.service.ts:64-68` + re-vérif sous verrou `:84-86`, testé e2e (403 assistant) |
| cloison entre cliniques | ✅ fait | `clinicId` du JWT partout ; test e2e « clinique 2 ne voit pas BIRCOVET » |
| tests e2e | ✅ fait | 12/12 sur Neon `cliva_test` |
| front branché | ✅ fait | `api.ts`, `DemoStoreContext` (file ordonnée, refresh, resynchro) |
| synchro entre postes | ⚠️ partiel | sondage `/state/version` 10 s implémenté (`DemoStoreContext:305-328`) — fonctionnel seulement pour les 134 ops du registre |
| mode démo conservé | ✅ fait | `apiMode` conditionne tout ; branche localStorage inchangée (`:276-301`) |

### 7.2 Problèmes trouvés

| # | Gravité | Fichier:ligne | Problème | Correction proposée |
|---|---|---|---|---|
| 1 | **Bloquant** | `apps/api/prisma/migrations/` | Migration `init` non appliquée sur la base principale → login = 500 `P2021` | `pnpm --filter api migrate:deploy` puis `pnpm --filter api seed` |
| 2 | **Important** | `registry.ts` | 135/262 services appelés par les écrans absents du registre → mutations perdues côté serveur en mode API | Compléter `OPERATIONS` domaine par domaine (hospitalisation, missions, achats, CRM, équipe…) |
| 3 | Important | — | `apps/web` inexistant : front à la racine ; `pnpm --filter web` et `apps/web/*` des specs sans objet | Déplacer le front dans `apps/web` (étape AUDIT §3.5) ou documenter la convention « web = racine » |
| 4 | Important | `seed.ts`, `auth.service.ts` | Aucun compte ne peut être créé via l'app : `admin.utilisateur.creer` ajoute un `User` dans l'état mais **pas d'`Account`** → cet utilisateur ne pourra jamais se connecter | Ajouter une opération/endpoint de provisionnement de compte (email + mdp initial) |
| 5 | Important | `DemoStoreContext.tsx:154` | File d'envoi en mémoire seule : recharger l'onglet avec des ops en attente les perd (silencieusement) | Persister la file (IndexedDB/localStorage) et la reprendre au bootstrap |
| 6 | Mineur | `DemoStoreContext.tsx:448` | `markNotificationsRead` écrit `db` sans opération → « lu » jamais synchronisé serveur | En faire une opération du registre |
| 7 | Mineur | `SignInForm.tsx`, `UserDropdown.tsx`, `DemoPage.tsx` | Écrans modifiés malgré « ne modifie AUCUN composant d'écran » | Justifié par le point 5 (masquage impossible autrement) ; à acter |
| 8 | Mineur | `eslint.config.mjs:18` | `apps/**` ignoré : pas de lint sur l'API | Ajouter un script `lint` à `apps/api` + config |
| 9 | Mineur | `DemoStoreContext.tsx:346` | Fallback `opKey` non-UUID si `crypto.randomUUID` absent → rejet `@IsUUID` et mutation perdue | Générer un vrai UUID v4 en repli |
| 10 | Mineur | `seed.ts` vs `redact.ts` | `stripDemoPasswords` implémenté en double | Réutiliser l'export de `@cliva/core` dans le seed |
| 11 | Mineur | — | Next.js 16.4.0 : vulnérabilité connue (rappel CLI au build) ; un panic Turbopack observé une fois | `next upgrade` quand validé |
| 12 | Mineur | `aiService.ts:51` | `new Date()` en repli si `todayIso` absent | Accepter le paramètre obligatoire ou documenter |

### 7.3 Ce qui manque avant une mise en ligne pour tests en clinique

1. **Appliquer la migration + seed sur `DATABASE_URL`** (bloquant immédiat).
2. **Compléter `OPERATIONS`** pour les domaines utilisés en test, sinon restreindre le périmètre annoncé aux 134 ops existantes.
3. **Provisionnement des comptes** : aujourd'hui seul le seed crée des `Account` ; il faut un flux « créer un utilisateur → créer son compte de connexion » (sinon aucun nouvel utilisateur ne peut se connecter).
4. **Persistance de la file d'ops** entre rechargements (mode dégradé réseau).
5. HTTPS obligatoire en prod (déjà géré : cookie `secure` conditionnel) + CORS restreint à l'origine réelle.
6. Compte « éditeur » : `db.platform.editor` n'a pas d'`Account` seedé → console plateforme inaccessible via l'API (à créer si nécessaire).
7. Sauvegardes/snapshots Neon et monitoring de `/api/health` avant pilote.
8. Mise à niveau Next.js (vulnérabilité signalée).
