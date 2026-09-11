# AVISO — application web complète (MVP full-stack)

Cette version transforme le prototype HTML fourni en application Next.js avec API et base SQLite via Prisma.

## 1. Installation
```bash
npm install
cp .env.example .env
npx prisma db push
npm run db:seed
npm run dev
```
Puis ouvrir http://localhost:3000.

## 2. Ce qui est déjà en place
- Frontend Next.js / React responsive
- Recherche par nom/catégorie et filtre par ville
- Fiches établissements
- API REST pour établissements et avis
- Base SQLite + Prisma
- Statut ACTIVE / PENDING / DISABLED
- Avis ONSITE / GENERAL
- Données de démonstration AVISO
- Structure prête pour authentification, WhatsApp, géolocalisation réelle et dashboard admin

## 3. Correctifs appliqués (revue de code)
- `tsconfig.json` : ajout de `baseUrl`/`paths` pour que l'alias `@/*` résolve correctement (sans ça, les 3 routes API ne compilaient pas).
- `app/page.tsx` : typage explicite de `icons` en `Record<string,string>` (au lieu de `any`), qui causait une erreur TypeScript (`unknown` non assignable à `ReactNode`) au build.
- Build Next.js (compilation + typecheck) validé avec succès après ces correctifs. Le lancement complet avec base de données n'a pas pu être testé dans cet environnement (téléchargement du moteur Prisma bloqué par le réseau du bac à sable) — à tester chez toi avec les commandes ci-dessus, qui devraient fonctionner normalement.

## 5. Fusion du prototype avancé (avis vérifiés par géolocalisation)
Le prototype `aviso-djaba-fusion.html` a été porté dans l'appli Next.js (et non gardé en JS client à part) :
- **Fiche établissement complète** : badges (formalisé / ouvert-fermé), stats (% recommandation, nombre d'avis, année d'inscription), tarif, adresse, disponibilité, avis récents, boutons Contacter (WhatsApp) et S'y rendre (Google Maps).
- **Avis vérifiés sur place** : porte de géolocalisation (rayon 200 m, 15 min sur place requises) avant de pouvoir déposer un avis "vérifié", avec bouton de simulation pour la démo. Les avis "généraux" (sans vérification) restent possibles mais ne comptent pas dans le taux affiché.
- **Formulaire d'ajout** avec bascule "C'est mon établissement" (publication immédiate, badge Formalisé si IFU renseigné) vs "Je recommande un lieu" (statut `PENDING`, vérifié par l'équipe avant publication).
- **Désactivation automatique** : un établissement passe en `DISABLED` si son taux tombe à 40% ou moins sur au moins 5 avis vérifiés sur place (`lib/business-rules.ts`, appliqué après chaque avis).
- **Espace admin (démo)** : `/api/admin/establishments` (liste tous statuts) et `/api/admin/simulate` (injecte des avis négatifs pour déclencher le seuil) ; réactivation via `PATCH /api/establishments/[id]`.
- Nouveaux champs Prisma : `sinceYear`, `mapsQuery`, `disabledReason`, `noGate` (ce dernier pour les services sans lieu physique fixe, ex. livraison).
- Build Next.js (compilation + typecheck) validé à nouveau après la fusion.

## 6. Prochaine étape production
Ajouter Auth.js, rôles CLIENT/OWNER/ADMIN, vérification de présence côté serveur, rate limiting, stockage photo, WhatsApp Business API, PostgreSQL et Google Maps/Mapbox.
