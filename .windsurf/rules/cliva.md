# Cliva — conventions du dépôt

- **Le front Next.js est à la racine du dépôt** — convention définitive : il n'y a pas (et il n'y aura pas) de dossier `apps/web`.
- **Le code métier partagé reste dans `src/lib`** (services, types, registre `OPERATIONS`, permissions, seed). `packages/core` (`@cliva/core`) le ré-exporte tel quel pour l'API — ne pas dupliquer la logique métier côté `apps/api`.
- L'API NestJS vit dans `apps/api` (port 3001, préfixe `/api`, Prisma + Neon/PostgreSQL).
- Mode démo : `NEXT_PUBLIC_API_URL` vide → `localStorage` ; renseigné → API réelle (JWT + cookie de rafraîchissement).
