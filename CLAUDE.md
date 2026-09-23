# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

Monorepo Turborepo (bun, Node >= 24, TypeScript 7) pour un visualiseur DXF.

- `apps/viewer` : front Vite 8 + React 19, avec React Compiler (via `@rolldown/plugin-babel` + `reactCompilerPreset` dans `vite.config.ts`), Tailwind v4 et shadcn (style `radix-nova`, primitives `radix-ui`, icônes `lucide-react`). Alias `@` → `apps/viewer/src`.
- `packages/ui` (`@repo/ui`) : librairie de composants partagée, exportée en `./*` → `src/*.tsx`. Pour l'instant un stub.
- `packages/typescript-config` : tsconfigs partagés.
- `tools/oxlint/anti-slop/` : plugin oxlint vendoré (anti-slop). Ne pas le modifier à la main : passer par le skill `install-anti-slop`.

Il n'y a pas encore de backend. Il sera en ElysiaJS.

## Commandes

```sh
bun install
bun dev                        # turbo dev (tous les workspaces)
bun run build                  # turbo build
bun check-types                # turbo check-types (tsc -b)
bun lint / bun lint:fix        # oxlint, depuis la racine uniquement (pas via turbo)
bun format / bun format:check  # oxfmt
bunx turbo build --filter=viewer   # un seul workspace
```

Composants shadcn : `bunx shadcn add <composant>` depuis `apps/viewer` (ils atterrissent dans `src/components/ui`).

Pas encore de framework de test.

Lefthook (pre-commit) lance `oxfmt` et `oxlint --fix` sur les fichiers stagés et restage le résultat.

## Lint

`oxlint.config.ts` : type-aware, `correctness`/`suspicious`/`perf` en erreur, `pedantic` en warning, et des règles anti-slop strictes en erreur. Les plus piégeuses :

- `no-object-parameters` : pas d'objet en paramètre de fonction.
- `no-array-filter-map`, `no-reduce-accumulator-copy`, `oxc/no-accumulating-spread`.
- `require-safety-comment-for-type-assertion` : toute assertion `as` doit être justifiée par un commentaire `// SAFETY: ...`.
- `no-unknown-parameters` / `no-unknown-returns` / `no-unsafe-dictionary-type`.
- `reportUnusedDisableDirectives` : un `oxlint-disable` inutile est une erreur.

## Règles de travail

- **Fin de tâche** : toujours lancer `bun lint:fix`, puis `bun lint`, `bun format` et `bun check-types`, et corriger ce qui reste avant de rendre la main. Ne pas contourner avec des `oxlint-disable` sauf justification réelle.
- **Backend** : toujours charger le skill `elysiajs` avant de toucher au code backend.
- **Front** : toujours charger les skills React avant de toucher au front : `vercel-react-best-practices` en général, `vercel-composition-patterns` pour l'architecture de composants, `vercel-react-view-transitions` pour les animations et transitions, `web-design-guidelines` pour la revue UI et l'accessibilité.

## React

- **Toujours appliquer single source of truth et single responsibility**, pour que l'app reste maintenable dans le temps :
  - chaque donnée a un seul propriétaire (un état, un store ou l'URL). Pas de copie d'une prop ou d'un état dans un autre état : on dérive au rendu ;
  - un composant a une seule responsabilité. Dès qu'il mélange récupération de données, logique métier et affichage, on le découpe : la logique va dans un hook ou un module pur, l'affichage dans des composants plus petits ;
  - la logique métier (parsing DXF, géométrie, transformations) vit dans des modules TypeScript purs, hors des composants, et reste testable sans React.
- **Le moins de `useEffect` possible.** Avant d'en écrire un, chercher l'alternative : valeur dérivée calculée au rendu, logique dans le handler d'événement, `key` pour réinitialiser un état, `useSyncExternalStore` pour une source externe, `use()` / Suspense pour les données. Un effet ne sert qu'à synchroniser avec un système externe (DOM impératif, canvas, abonnement, WebGL…).
- **React Compiler actif** : ne pas ajouter `useMemo` / `useCallback` / `memo` par réflexe, le compilateur mémoïse déjà. Il suppose du code qui respecte les règles de React, sinon il produit des rendus périmés ou incohérents sans erreur visible :
  - pas de mutation de props, d'état ou de valeurs issues de hooks, pas de mutation d'objets après leur passage en JSX ;
  - pas de lecture ou d'écriture de `ref.current` pendant le rendu ;
  - rendu pur : pas d'effet de bord, pas de `Math.random()` / `Date.now()` dans le corps du composant ;
  - données impératives lourdes (parsing DXF, scène, buffers) gardées hors de l'état React ou traitées comme immuables.
  - Si un composant se comporte bizarrement, suspecter le compilateur : vérifier les règles ci-dessus, et en dernier recours `"use no memo"` en tête du composant, avec un commentaire qui explique pourquoi.
