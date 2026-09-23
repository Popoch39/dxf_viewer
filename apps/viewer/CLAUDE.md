# Viewer (`apps/viewer`)

Toujours charger les skills React avant de toucher au front : `vercel-react-best-practices` en général, `vercel-composition-patterns` pour l'architecture de composants, `vercel-react-view-transitions` pour les animations et transitions, `web-design-guidelines` pour la revue UI et l'accessibilité.

## React

- **Toujours appliquer single source of truth et single responsibility**, pour que l'app reste maintenable dans le temps :
  - chaque donnée a un seul propriétaire (un état, un store, l'URL ou le cache TanStack Query). Pas de copie d'une prop ou d'un état dans un autre état : on dérive au rendu ;
  - un composant a une seule responsabilité. Dès qu'il mélange récupération de données, logique métier et affichage, on le découpe : la logique va dans un hook ou un module pur, l'affichage dans des composants plus petits ;
  - la logique métier (parsing DXF, géométrie, transformations) vit dans des modules TypeScript purs, hors des composants, et reste testable sans React.
- **État client partagé** : dans un store zustand, jamais dans le cache TanStack Query, qui ne porte que des données serveur. Tous les stores sont rangés dans `src/store/`, avec un fichier par store (`session-store.ts`…). Chaque store exporte le hook `use<Nom>Store` et des sélecteurs nommés d'après le domaine (`useCurrentUser()`).
  - **Une valeur par sélecteur, jamais de destructuration** : `const user = useSessionStore((state) => state.user)`, et un appel par valeur si un composant en lit plusieurs. `const { user, loaded } = useSessionStore()`, ou un sélecteur qui renvoie un objet, abonne le composant à tout le store, qui se rerend alors à chaque changement, même d'une valeur qu'il n'affiche pas. Les actions se lisent de la même façon, une par une (`useSessionStore((state) => state.signedOut)`). Hors React, on passe par `useSessionStore.getState().signedOut()`.
- **Le moins de `useEffect` possible.** Avant d'en écrire un, chercher l'alternative : valeur dérivée calculée au rendu, logique dans le handler d'événement, `key` pour réinitialiser un état, `useSyncExternalStore` pour une source externe, TanStack Query pour les données serveur. Un effet ne sert qu'à synchroniser avec un système externe (DOM impératif, canvas, abonnement, WebGL…).
- **React Compiler actif** : ne pas ajouter `useMemo` / `useCallback` / `memo` par réflexe, le compilateur mémoïse déjà. Il suppose du code qui respecte les règles de React, sinon il produit des rendus périmés ou incohérents sans erreur visible :
  - pas de mutation de props, d'état ou de valeurs issues de hooks, pas de mutation d'objets après leur passage en JSX ;
  - pas de lecture ou d'écriture de `ref.current` pendant le rendu ;
  - rendu pur : pas d'effet de bord, pas de `Math.random()` / `Date.now()` dans le corps du composant ;
  - données impératives lourdes (parsing DXF, scène, buffers) gardées hors de l'état React ou traitées comme immuables.
  - Si un composant se comporte bizarrement, suspecter le compilateur : vérifier les règles ci-dessus, et en dernier recours `"use no memo"` en tête du composant, avec un commentaire qui explique pourquoi.

## Routing (TanStack Router)

- **File-based** : une route par fichier dans `src/routes/` (`__root.tsx` pour le layout racine, `index.tsx` pour `/`, `drawings/$id.tsx` pour `/drawings/:id`…). Un fichier ou dossier préfixé par `-` est ignoré. Le plugin Vite (`@tanstack/router-plugin`, placé avant `react()`) génère `src/routeTree.gen.ts` en dev comme en build : ce fichier est commité, exclu d'oxlint et d'oxfmt, et ne s'édite jamais à la main. `autoCodeSplitting` découpe chaque route automatiquement.
- **Router** : `src/router.ts` crée le router et déclare `Register` (liens et params typés partout). `RouterProvider` est rendu sous `QueryClientProvider` dans `main.tsx`.
- **Avec TanStack Query** : le `queryClient` est dans le contexte du router (`createRootRouteWithContext`). Un `loader` précharge avec la fabrique, `loader: ({ context, params }) => context.queryClient.ensureQueryData(drawingQueries.detail(params.id))`, et le composant lit ensuite la donnée par son hook `use*`. Le cache reste celui de TanStack Query : `defaultPreloadStaleTime: 0`, et le preload au survol des liens (`defaultPreload: "intent"`) passe par lui.
- **L'URL est un propriétaire d'état** : filtres, onglet, sélection partageable vont dans les params ou les search params (`validateSearch`), pas dans un `useState`.

## Data fetching (TanStack Query + Eden Treaty)

- **Env** : copier `.env.example` en `.env`. `src/env.ts` lève au démarrage si `VITE_API_URL` manque. Côté API, `VIEWER_URL` doit être l'origine du viewer (CORS avec credentials).
- **Client** : `src/api/client.ts` exporte `api` (Eden Treaty typé par `type App` du workspace `api`, cookie de session envoyé) et `unwrap()`, qui renvoie `data` ou lève une `ApiRequestError` (`status`, `code`, `message`, `details` de l'enveloppe d'erreur). Toute `queryFn` / `mutationFn` passe par `unwrap()` : c'est elle qui fait échouer la requête côté TanStack Query. Le `QueryClient` (`src/api/query-client.ts`) ne retente jamais une 4xx.
- **Un dossier par module de l'API** : `src/api/<module>/`, calqué sur `apps/api/src/modules/<module>` (`auth/`, `drawings/`…), qui s'importe par `@/api/<module>`. Seuls `client.ts` et `query-client.ts`, partagés, restent à la racine de `src/api/`. `src/api/` ne contient que le transport. La logique pure dont les composants ont besoin (schémas de formulaire, traduction des erreurs…) va dans `src/<domaine>/` (par exemple `src/auth/`), avec ses tests. Le `index.ts` du dossier contient, dans cet ordre :
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
- **Chargement : tout appel à l'API a un état de chargement visible**, jamais d'écran blanc ni de bouton qui ne réagit pas :
  - une route dont le `beforeLoad` ou le `loader` attend l'API déclare un `pendingComponent` : un squelette (`Skeleton` de shadcn) qui reprend la mise en page de la page, pour que rien ne bouge quand elle s'affiche. Le texte statique (titres, labels) s'affiche tel quel, seul ce qui dépend de la donnée est en squelette. Exemples : `AuthFormSkeleton`, `AppHeaderSkeleton`. Le router l'affiche après 150 ms (`defaultPendingMs`) ;
  - un composant qui lit une query rend un squelette tant que `isPending`, jamais `null` ;
  - un bouton qui déclenche une mutation est `disabled` pendant `isPending` et affiche un `Spinner` (en `data-icon="inline-start"`, ou à la place de son icône) ;
  - le conteneur d'un squelette est un `<output aria-label="Chargement">` (rôle `status` implicite, le lint refuse `role="status"`). Le `Spinner` est décoratif (`aria-hidden`) : c'est le bouton désactivé et son texte qui informent.
- **Composants** : ils consomment uniquement les hooks `use*` de `src/api/<module>/`. `api`, `useQuery` et `useMutation` restent confinés à `src/api/`. Les données serveur vivent dans le cache TanStack Query : on les lit par le hook là où on en a besoin, sans les recopier dans un `useState`.

## Auth (Utilisateur et Session)

- **Client** : Eden ne type pas `/api/auth/*`, donc `src/api/auth/` passe par le client vanilla de Better Auth (`better-auth/client`), jamais par `better-auth/react`. Chaque appel passe par `unwrapAuth()`, qui lève une `ApiRequestError` comme `unwrap()`.
- **Utilisateur connecté** : c'est un état client, porté par le store zustand `src/store/session-store.ts` et jamais par le cache TanStack Query. On le lit avec `useCurrentUser()`, qui vaut `null` sans Session. Seul `src/api/auth/` écrit dans ce store, avec `signedIn` et `signedOut` :
  - `loadCurrentUser()` demande la Session à l'API une fois par chargement de page, puis répond depuis le store ;
  - les hooks de connexion, d'inscription et de déconnexion mettent le store à jour dans leur `onSuccess`, et la déconnexion vide aussi le cache Query.
- **Routes** : une page qui demande une Session se met sous le layout sans segment `src/routes/_authenticated.tsx`. Son `beforeLoad` fait `await loadCurrentUser()` et redirige vers `/login?redirect=<url>` s'il obtient `null`. `/login` et `/register` renvoient vers `redirect` (ou `/`) si une Session existe déjà. `authSearchSchema` (`src/auth/schemas.ts`) n'accepte que des chemins internes, pour éviter un open redirect.
- **401** : le `QueryClient` est créé dans `src/router.ts` par `createQueryClient(onUnauthorized)`. Toute query ou mutation qui reçoit un 401 passe le store en `signedOut` et renvoie vers `/login`.
- **Formulaires** : react-hook-form, zod et les composants shadcn `Field`. Un formulaire reçoit `onSubmit`, `pending` et `error` en props, et c'est la route qui le branche sur les hooks. C'est ce qui permet de le tester sans mock de module (lint `no-module-mocking`). Une erreur ne doit jamais décaler le formulaire : `FieldError` et `AuthFormError` réservent leur ligne même vides.

## Upload (Dessins)

- **Deux propriétaires** : le Statut d'un Dessin vient du serveur (cache TanStack Query, liste `drawingQueries.list()`). L'état de l'Upload qui n'existe que dans l'onglet (file d'attente, progression, erreur locale) vit dans `src/store/upload-store.ts`, indexé par `localId`, avec le `drawingId` dès que `POST /drawings` a répondu. La carte d'un Dessin superpose son Upload s'il en a un (`useUploadOf`), sinon elle affiche son Statut. Un Dessin en `awaiting_upload` sans Upload dans l'onglet est un « Upload interrompu ».
- **Orchestration** : `src/api/drawings/upload.ts` est seul à écrire dans le store (`useStartUploads`, `useCancelUpload`). Il lance au plus 3 Uploads à la fois, et ne crée le Dessin qu'au démarrage de son Upload, pour que l'URL présignée n'expire pas dans la file. Le PUT vers le stockage passe par un XHR, car `fetch` ne donne pas la progression d'un envoi. Annuler, ou fermer un Upload en échec, supprime son Dessin.
- **Statut en temps réel** : `useDrawingStatus(id, enabled)` ouvre un `EventSource` (`withCredentials`) tant que le Dessin est en `queued`/`parsing`, et écrit chaque changement dans la liste. Un Statut final relit la liste, pour récupérer le Résumé.
- **Logique pure** dans `src/uploads/` (validation, progression et temps restant, file, messages d'erreur) et `src/drawings/card-view.ts` (ce qu'affiche une carte), testée sans React.
- Le stockage doit accepter le CORS `PUT` depuis l'origine du viewer. MinIO en local l'accepte de toute origine par défaut ; en prod, le configurer sur le bucket.

## Tests

- `bun run test` (vitest + Testing Library, jsdom) : les tests `src/**/*.test.{ts,tsx}`, sans réseau.
- `bun run test:e2e` (Playwright) : `e2e/`, contre la vraie API. Il faut `bun infra:up` et `apps/api/.env` avec `VIEWER_URL=http://localhost:5173`. Il réutilise l'API et le viewer s'ils tournent déjà, sinon il les démarre (l'API avec son worker, pour le Parsing). Il n'est pas branché sur `turbo test`. La première fois, lancer `bunx playwright install chromium`.
