# Viewer (`apps/viewer`)

Toujours charger les skills React avant de toucher au front : `vercel-react-best-practices` en général, `vercel-composition-patterns` pour l'architecture de composants, `vercel-react-view-transitions` pour les animations et transitions, `web-design-guidelines` pour la revue UI et l'accessibilité.

## React

- **Toujours appliquer single source of truth et single responsibility**, pour que l'app reste maintenable dans le temps :
  - chaque donnée a un seul propriétaire (un état, un store, l'URL ou le cache TanStack Query). Pas de copie d'une prop ou d'un état dans un autre état : on dérive au rendu ;
  - un composant a une seule responsabilité. Dès qu'il mélange récupération de données, logique métier et affichage, on le découpe : la logique va dans un hook ou un module pur, l'affichage dans des composants plus petits ;
  - la logique métier (parsing DXF, géométrie, transformations) vit dans des modules TypeScript purs, hors des composants, et reste testable sans React.
- **Le moins de `useEffect` possible.** Avant d'en écrire un, chercher l'alternative : valeur dérivée calculée au rendu, logique dans le handler d'événement, `key` pour réinitialiser un état, `useSyncExternalStore` pour une source externe, TanStack Query pour les données serveur. Un effet ne sert qu'à synchroniser avec un système externe (DOM impératif, canvas, abonnement, WebGL…).
- **React Compiler actif** : ne pas ajouter `useMemo` / `useCallback` / `memo` par réflexe, le compilateur mémoïse déjà. Il suppose du code qui respecte les règles de React, sinon il produit des rendus périmés ou incohérents sans erreur visible :
  - pas de mutation de props, d'état ou de valeurs issues de hooks, pas de mutation d'objets après leur passage en JSX ;
  - pas de lecture ou d'écriture de `ref.current` pendant le rendu ;
  - rendu pur : pas d'effet de bord, pas de `Math.random()` / `Date.now()` dans le corps du composant ;
  - données impératives lourdes (parsing DXF, scène, buffers) gardées hors de l'état React ou traitées comme immuables.
  - Si un composant se comporte bizarrement, suspecter le compilateur : vérifier les règles ci-dessus, et en dernier recours `"use no memo"` en tête du composant, avec un commentaire qui explique pourquoi.

## Data fetching (TanStack Query + Eden Treaty)

- **Env** : copier `.env.example` en `.env`. `src/env.ts` lève au démarrage si `VITE_API_URL` manque. Côté API, `VIEWER_URL` doit être l'origine du viewer (CORS avec credentials).
- **Client** : `src/api/client.ts` exporte `api` (Eden Treaty typé par `type App` du workspace `api`, cookie de session envoyé) et `unwrap()`, qui renvoie `data` ou lève une `ApiRequestError` (`status`, `code`, `message`, `details` de l'enveloppe d'erreur). Toute `queryFn` / `mutationFn` passe par `unwrap()` : c'est elle qui fait échouer la requête côté TanStack Query. Le `QueryClient` (`src/api/query-client.ts`) ne retente jamais une 4xx.
- **Un fichier par module de l'API** : `src/api/<module>.ts`, calqué sur `apps/api/src/modules/<module>` (`drawings.ts`, `auth.ts`…). Chaque fichier contient, dans cet ordre :
  1. une fabrique `<module>Queries` de `queryOptions`, avec des clés hiérarchiques qui partent du nom du module, pour que l'invalidation d'un préfixe couvre ses enfants :

     ```ts
     export const drawingQueries = {
       all: () => ["drawings"] as const,
       list: () =>
         queryOptions({
           queryKey: [...drawingQueries.all(), "list"],
           queryFn: () => unwrap(api.drawings.get()),
         }),
       detail: (id: string) =>
         queryOptions({
           queryKey: [...drawingQueries.all(), "detail", id],
           queryFn: () => unwrap(api.drawings({ id }).get()),
         }),
     };
     ```

     Elle sert aussi hors composant : `prefetchQuery`, `ensureQueryData`, `setQueryData`, `invalidateQueries`.

  2. les hooks réutilisables, nommés d'après le domaine (`CONTEXT.md`) : `useDrawings()`, `useDrawing(id)`, `useCreateDrawing()`, `useRenameDrawing()`… Arguments positionnels (lint `no-object-parameters`).
- **Mutations** : chaque hook de mutation met à jour ou invalide lui-même le cache dans son `onSuccess`, via la fabrique. Le composant appelle `mutate` et gère seulement l'UI (toast, fermeture de dialogue…).
- **Composants** : ils consomment uniquement les hooks `use*` de `src/api/<module>.ts`. `api`, `useQuery` et `useMutation` restent confinés à `src/api/`. Les données serveur vivent dans le cache TanStack Query : on les lit par le hook là où on en a besoin, sans les recopier dans un `useState`.
