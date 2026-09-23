# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

Monorepo Turborepo (bun, Node >= 24, TypeScript 7) pour un visualiseur DXF.

- `apps/viewer` : front Vite 8 + React 19, avec React Compiler (via `@rolldown/plugin-babel` + `reactCompilerPreset` dans `vite.config.ts`), Tailwind v4 et shadcn (style `radix-nova`, primitives `radix-ui`, icônes `lucide-react`), TanStack Query sur un client Eden Treaty. Alias `@` → `apps/viewer/src`. Ses règles (React, data fetching) sont dans `apps/viewer/CLAUDE.md`.
- `apps/api` : backend Elysia sur Bun, avec Drizzle (driver Bun SQL), Redis (`RedisClient` de Bun) et un stockage S3 (`S3Client` de Bun, MinIO en local). Il exporte `type App` pour le client Eden Treaty du viewer.
- `packages/dxf` (`@repo/dxf`) : module DXF. `parseDxf(texte)` renvoie un `ParsedDrawing` (schéma TypeBox exporté, validé avant d'être renvoyé) ou lève `InvalidDxfError`. Seul `src/dxf-parser.ts` connaît la lib `dxf-parser`. Les fixtures de test sont générées par `test/fixtures/generate.py` (ezdxf).
- `packages/ui` (`@repo/ui`) : librairie de composants partagée, exportée en `./*` → `src/*.tsx`. Pour l'instant un stub.
- `packages/typescript-config` : tsconfigs partagés.
- `tools/oxlint/anti-slop/` : plugin oxlint vendoré (anti-slop). Ne pas le modifier à la main : passer par le skill `install-anti-slop`.

La spec produit est l'issue GitHub #1, découpée en tickets #2 à #9. Le vocabulaire du domaine (Dessin, Fichier source, Dessin parsé, Statut…) est défini dans `CONTEXT.md` : l'employer tel quel dans le code, les tests et l'API.

## Commandes

```sh
bun install
bun infra:up / bun infra:down  # Postgres, Redis, MinIO (compose.yaml) + création du bucket
bun dev                        # turbo dev (tous les workspaces)
bun run test                   # turbo test (bun test par package ; `bun test` seul lance le runner de bun à la racine)
bun run build                  # turbo build
bun check-types                # turbo check-types
bun lint / bun lint:fix        # oxlint, depuis la racine uniquement (pas via turbo)
bun format / bun format:check  # oxfmt
bunx turbo build --filter=viewer   # un seul workspace
```

Composants shadcn : `bunx shadcn add <composant>` depuis `apps/viewer` (ils atterrissent dans `src/components/ui`).

Lefthook (pre-commit) lance `oxfmt` et `oxlint --fix` sur les fichiers stagés et restage le résultat. Les deux commandes ont besoin de `--no-error-on-unmatched-pattern` : sans cette option, un commit dont tous les fichiers stagés sont ignorés (`.agents/**`, `.claude/**`…) échoue sur « No files found ».

## API (`apps/api`)

- **Env** : copier `apps/api/.env.example` en `apps/api/.env` (Bun le charge tout seul). `src/env.ts` fait échouer le démarrage si une variable manque.
- **Ports de l'infra locale** décalés (Postgres 5442, Redis 6389, MinIO 9010, console 9011), car les ports par défaut servent à d'autres stacks sur la machine. MinIO ne publie plus sur Docker Hub : les images viennent de `quay.io/minio/*`, avec des versions figées.
- **Structure** : un dossier par module dans `src/modules/<module>/`, avec `index.ts` (routes Elysia), `service.ts` (logique, sans Elysia) et `model.ts` (schémas TypeBox), ce dernier seulement si le module déclare des schémas de routes. Un schéma et son type portent le même nom (`export const Health = t.Object(…)` et `export type Health = typeof Health.static`) : les warnings `no-redeclare` qui en résultent sont acceptés.
- **Erreurs** : le handler global de `src/errors.ts` renvoie toute erreur sous la forme `{ error: { code, message, details? } }`. Une erreur métier se lève avec `throw new ApiError(status, code, message)`, avec un `code` stable. Le `status` est typé en `ErrorStatus` (4xx/5xx) : avec un simple `number`, Eden typerait l'enveloppe d'erreur comme réponse de tous les statuts, 200 compris.
- **Logs** : pino, en JSON sur stdout. Le `logger` s'importe depuis `src/logger.ts`, depuis un service comme depuis un worker, et son niveau se règle avec `LOG_LEVEL` (`info` par défaut). En dev, `pino-pretty` est branché en pipe dans les scripts `dev:api` et `dev:worker`. Ne jamais passer par un transport pino : les transports tournent dans des worker threads, que les binaires `bun build --compile` ne chargent pas. `src/request-logger.ts` écrit une ligne par requête, au niveau `info` en 2xx/3xx, `warn` en 4xx et `error` en 5xx, cette dernière avec `err`. Il pose aussi le header `x-request-id`, et il doit être `.use()` avant `errorHandler`. Ne jamais logger de body ni de header : la `redact` n'est qu'un filet. Les tests tournent en `silent` (voir `test/setup.ts`) ; `LOG_LEVEL=debug bun test` pour les voir.
- **Auth** : Better Auth (email + mot de passe, session par cookie) dans `src/modules/auth/`. Son handler est servi par une route `/api/auth/*` et pas par `.mount()` : sans préfixe, `.mount()` capte toutes les URL et remplace notre 404. Pour protéger une route, on fait `.use(authPlugin)` puis on passe `{ auth: true }` : le handler reçoit alors `user` et `session`, et la route renvoie 401 `UNAUTHORIZED` sans session valide. Les requêtes authentifiées par cookie doivent porter un `Origin` égal à `BETTER_AUTH_URL` ou `VIEWER_URL` (`trustedOrigins`). Le viewer est sur une autre origine : `@elysiajs/cors` (dans `src/app.ts`) n'autorise que `VIEWER_URL`, avec credentials. Les routes Better Auth sont documentées dans l'OpenAPI à partir de leur propre schéma.
- **Drizzle** : chaque module déclare ses tables dans son propre `schema.ts` (glob `src/**/schema.ts` dans `drizzle.config.ts`). Nos clés primaires sont des UUID v7 générés par la base (``uuid("id").primaryKey().default(sql`uuidv7()`)``), ce qui demande Postgres 18 ou plus ; les tables Better Auth gardent leurs propres id. `bun run db:generate` génère une migration dans `apps/api/drizzle/`, et `bun run db:migrate` l'applique. Le dossier de migrations est résolu depuis le répertoire courant (`./drizzle`) : lancer ces commandes depuis `apps/api`.
- **Parsing** : file BullMQ dans `src/parsing/` (`queue.ts`, `service.ts`, `worker.ts`), consommée par un process séparé, `src/worker.ts`, que `bun dev` lance à côté de l'API (`dev:api` + `dev:worker`). BullMQ se connecte avec le `RedisClient` de Bun, sans `ioredis`. Un DXF invalide passe le Dessin en `failed` sans être levé hors du job ; toute autre erreur est levée et BullMQ la retente. Chaque écriture du worker est conditionnée sur `pendingSourceKey`. Voir `docs/adr/0002-parsing-asynchrone-bullmq.md`.
- **Statut en temps réel** : `src/parsing/events.ts`. Toute écriture qui change un Statut fait `.returning(statusColumns)`, puis `publishStatus()` une fois le changement commité (publication best effort, jamais levée). `GET /drawings/:id/events` (SSE) s'abonne avant de lire le Statut courant, envoie ce Statut, puis relaie les changements. Il écarte ceux dont l'`updatedAt` est plus ancien que le dernier envoyé : `updatedAt` vient de l'horloge de Postgres (`now()`), commune à l'API et au worker. Dans le process API, une seule connexion Redis porte tous les abonnements. Chaque flux se désabonne dès que `request.signal` est aborté, ce qui arrive à la déconnexion du client. En test, on passe `fetch: { signal }` à Eden pour simuler cette déconnexion.
- **Tests** : `bun test` dans `apps/api`, contre la vraie infra (`bun infra:up` d'abord). `test/setup.ts` (preload de `bunfig.toml`) applique les migrations. On passe par un client Eden Treaty construit sur l'instance, `treaty(app)`, sans réseau ni mock de module. Pour une route inconnue, ou une route que Eden ne sait pas typer (Better Auth), on utilise `app.handle(new Request(…))`. Une app de test ne se construit qu'une seule fois avec `.use(app)` par process : les routes OpenAPI ne s'enregistrent pas deux fois (erreur `Body is disturbed or locked`). Pour une route protégée de test, partir de `authPlugin`. Les tests qui ont besoin du Parsing démarrent le worker dans le process (`startParsingWorker()`, fermé en `afterAll`). `test/setup.ts` fixe `MAX_UPLOAD_BYTES` à 64 Kio, pour pouvoir tester un fichier trop gros.
- **Docker de prod** : `apps/api/Dockerfile`, à builder depuis la racine du repo (`bun run --cwd apps/api docker:build`), car le `bun.lock` du monorepo y est. L'image contient trois binaires compilés, `./server` (CMD par défaut), `./worker` et `./migrate`, sur une base distroless. Si un workspace est ajouté, copier aussi son `package.json` dans l'étape d'install du Dockerfile, sinon `--frozen-lockfile` échoue ; si l'API importe un nouveau workspace, copier aussi ses sources avant le build (comme `packages/dxf`).

## Lint

`oxlint.config.ts` : type-aware, `correctness`/`suspicious`/`perf` en erreur, `pedantic` en warning, et des règles anti-slop strictes en erreur. Les plus piégeuses :

- `no-object-parameters` : pas d'objet en paramètre de fonction.
- `no-array-filter-map`, `no-reduce-accumulator-copy`, `oxc/no-accumulating-spread`.
- `require-safety-comment-for-type-assertion` : toute assertion `as` doit être justifiée par un commentaire `// SAFETY: ...`.
- `no-unknown-parameters` / `no-unknown-returns` / `no-unsafe-dictionary-type`.
- `reportUnusedDisableDirectives` : un `oxlint-disable` inutile est une erreur.

## Règles de travail

- **Fin de tâche** : toujours lancer `bun lint:fix`, puis `bun lint`, `bun format`, `bun check-types` et `bun run test`, et corriger ce qui reste avant de rendre la main. Ne pas contourner avec des `oxlint-disable` sauf justification réelle.
- **Backend** : toujours charger le skill `elysiajs` avant de toucher au code backend.
- **Front** : lire `apps/viewer/CLAUDE.md` avant de toucher au viewer.
