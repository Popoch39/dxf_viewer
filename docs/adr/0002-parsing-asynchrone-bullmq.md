# Parsing asynchrone avec BullMQ + Redis, plutôt que synchrone ou avec une file dans Postgres

- Statut : accepté
- Date : 2026-09-23
- Ticket : #5 (spec #1)

## Contexte

Une fois le Fichier source déposé dans le stockage (voir l'ADR 0001), il faut le lire, le parser avec `parseDxf`, écrire le Dessin parsé dans le stockage, puis mettre à jour le Résumé. Pour un plan réel de plusieurs dizaines de Mo, cela prend de quelques secondes à bien plus, et le parsing occupe le CPU pendant tout ce temps.

Trois façons de le faire :

1. **Synchrone** : `POST /drawings/:id/complete` parse le fichier avant de répondre.
2. **File dans Postgres** : une table de jobs, consommée par un worker avec `SELECT … FOR UPDATE SKIP LOCKED`.
3. **BullMQ sur Redis** : `/complete` met un job en file, un worker dans un process séparé le consomme.

## Décision

On retient BullMQ sur Redis. `/complete` vérifie le fichier par un HEAD, passe le Dessin en `queued` et met en file un job `{ drawingId, sourceKey }`. La mise en file est faite pendant la transaction Postgres qui change le Statut : si elle échoue, la transaction est annulée et le Statut n'a pas bougé. Ce n'est pas une transaction commune aux deux systèmes : si le commit échouait après la mise en file, le job tournerait quand même, ce qui reste sans danger (voir plus bas, les écritures conditionnées sur la clé en attente). Le worker (`src/worker.ts`) est un process à part, lancé à côté de l'API par le `dev` du monorepo et livré comme un binaire `./worker` dans l'image.

Le job gère deux sortes d'échec :

- un **DXF invalide** (`InvalidDxfError`) n'est pas levé hors du job : le Dessin passe directement en `failed` avec le message d'erreur, et le fichier rejeté est supprimé. Il n'y a donc pas de nouvel essai ;
- toute **autre erreur** (stockage, BDD) est levée, et BullMQ retente le job 5 fois avec un backoff exponentiel. Une fois les essais épuisés, le Dessin passe en `failed`, mais son fichier reste en attente : refaire `/complete` relance un Parsing.

BullMQ passe par le `RedisClient` natif de Bun, comme le reste de l'API. Aucune dépendance à `ioredis` n'est ajoutée.

## Conséquences

Gains :

- l'API répond tout de suite (202) et ne consomme jamais de CPU de parsing : un gros plan ne ralentit pas les autres requêtes ;
- on peut faire évoluer le nombre de workers (`PARSING_CONCURRENCY` par process, plus de process si besoin) indépendamment de l'API ;
- les nouveaux essais, le backoff et la reprise des jobs après le plantage d'un worker sont fournis par BullMQ ;
- Redis est de toute façon dans la stack, pour le pub/sub des changements de Statut (#6).

Coûts, et comment on les couvre :

- **Un process de plus à déployer et à superviser.** Il partage le code et l'image de l'API : c'est le même build, avec un autre point d'entrée.
- **Le job et la ligne vivent dans deux systèmes différents**, sans transaction commune. Chaque écriture du worker est donc conditionnée sur la clé du fichier en attente : un job dont le fichier n'est plus en attente (Dessin supprimé, fichier remplacé) ne change rien, et le Dessin parsé qu'il a pu écrire est supprimé. Le job est idempotent : la clé du Dessin parsé dépend de l'empreinte sha256 du fichier, et un nouvel essai réécrit le même objet.
- **Le client doit attendre le résultat** : il suit le Statut, en consultant le Dessin ou par le flux SSE (#6).

## Alternatives écartées

- **Synchrone** : le plus simple, mais une requête peut durer longtemps sur un gros plan, bloquer le CPU de l'API pour tous les autres utilisateurs, et se heurter aux timeouts d'un proxy. Un plantage du parseur ferait aussi tomber le process de l'API. Et il n'y a aucun nouvel essai en cas de panne passagère.
- **File dans Postgres** : pas de nouvelle brique, et le job serait mis en file dans la même transaction que la ligne. Mais il faudrait écrire nous-mêmes les nouveaux essais, le backoff, la reprise des jobs orphelins et le réveil des workers (par polling ou `LISTEN/NOTIFY`). Redis est de toute façon nécessaire pour le temps réel, donc BullMQ n'ajoute pas de dépendance d'infra.
