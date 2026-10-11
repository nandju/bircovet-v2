# BIRCOVET — Plateforme de gestion vétérinaire (démonstration frontend)

BIRCOVET est une **démonstration frontend complète** d'une plateforme de gestion de clinique vétérinaire en Côte d'Ivoire, construite sur le template TailAdmin (Next.js + Tailwind CSS).

> Toutes les données sont **fictives**, générées localement et persistées dans `localStorage`.
> Aucun backend, aucune base de données, aucun paiement, SMS, e-mail, WhatsApp ou appel IA réel.

## Lancement

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de production
npm run lint
npm run test:rules # tests des règles métier simulées (20 scénarios)
```

## Comptes de démonstration

Tous les comptes partagent le mot de passe fictif **`Demo@2026`** :

| Profil | Email | Rôle |
| --- | --- | --- |
| DG | `dg@bircovet.demo` | Directrice générale — accès complet, validations |
| Accueil | `accueil@bircovet.demo` | Accueil, stock, encaissements |
| Vétérinaire | `vet@bircovet.demo` | Clinique, consultations, hospitalisations |
| Comptable | `comptable@bircovet.demo` | Facturation et finances (hors confidentialité DG) |

Un menu **« Environnement de démonstration »** (Administration → Démo) permet de changer de profil à la volée, simuler le mode hors ligne, synchroniser la file d'attente, résoudre des conflits, exporter/importer une sauvegarde JSON et réinitialiser les données.

## Modules

Tableau de bord · Clients (doublons, fusion) · Patients (dossier clinique, décès/euthanasie) · Exploitations · Agenda et file d'attente · Consultations (assistant ≠ vétérinaire responsable, validation) · Ordonnances (délivrance partielle, reliquats, FEFO) · Hospitalisation · Stock (lots, péremptions, quarantaine, inventaires, transferts, corrections DG) · Achats / fournisseurs / réceptions (BLI-EDI simulé) · Facturation (devis, factures, avoirs, facturation regroupée, documents imprimables « SANS VALEUR FISCALE ») · Finances (encaissements, dépenses, comptes, transferts, crédits DG, créances) · Missions terrain (stock mobile, rapprochement) · Tâches, rappels et interactions · Formations (capacité, présences, facturation par payeur) · Documents · Rapports · Assistant IA simulé (brouillons uniquement) · Administration (utilisateurs, rôles, établissements, paramètres, journal, environnement démo) · Mode hors ligne simulé avec synchronisation idempotente.

## Points d'intégration backend (à faire)

- `src/context/DemoStoreContext.tsx` → `run` est le point unique d'appel des services simulés ; le remplacer par des appels API en conservant les signatures de `src/lib/services/*`.
- Authentification réelle (JWT/session serveur) à la place de `login` simulé.
- Paiements Mobile Money / banque, SMS/WhatsApp, e-mails, IA : services externes à brancher côté serveur.
- Numérotation fiscale officielle : les documents portent la mention « DÉMONSTRATION — SANS VALEUR FISCALE ».

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · next-intl (fr) · ApexCharts.
