# Upload du Fichier source par URL présignée directe, plutôt qu'en multipart via l'API

- Statut : accepté
- Date : 2026-09-23
- Ticket : #4 (spec #1)

## Contexte

Un Propriétaire envoie des fichiers DXF qui peuvent peser jusqu'à la limite configurée (`MAX_UPLOAD_BYTES`, 200 Mo par défaut). Le Fichier source est conservé tel quel dans le stockage objet compatible S3 (MinIO en local), où le worker de Parsing le lit ensuite.

Deux façons de l'y déposer :

1. **Multipart via l'API** : le client poste le fichier à l'API, qui le relaie vers le stockage.
2. **URL présignée directe** : l'API crée le Dessin et renvoie une URL PUT signée, à durée limitée ; le client envoie le fichier directement au stockage, puis le signale à l'API (`POST /drawings/:id/complete`, #5).

## Décision

On retient l'URL présignée directe. `POST /drawings` renvoie `{ drawing, uploadUrl }`, avec le Dessin en `awaiting_upload` et une URL PUT valable 10 minutes, qui vise une clé neuve pour chaque upload.

## Conséquences

Gains :

- le fichier ne transite jamais par l'API : pas de corps de 200 Mo en mémoire ou en disque temporaire, pas de requête longue qui bloque une connexion, et pas de limite de taille de corps à régler sur l'API ou sur un proxy devant elle ;
- la bande passante et les reprises sur erreur sont à la charge du stockage, qui est fait pour ça ;
- l'API reste sans état vis-à-vis des fichiers, ce qui simplifie sa mise à l'échelle.

Coûts, et comment on les couvre :

- **Une URL PUT présignée ne peut pas imposer une taille.** La taille déclarée à la création est validée tout de suite (400 au-delà de la limite). La taille réelle est revérifiée par un HEAD au `/complete`, qui refuse un objet absent ou trop gros. Si ça ne suffit plus, on passera à un POST présigné avec une condition `content-length-range`.
- **L'upload se fait en deux temps** (création, puis `/complete`). Un Dessin dont l'upload est abandonné reste en `awaiting_upload`, ce qui le rend repérable. Son nettoyage automatique est hors périmètre de la V1.
- **Le navigateur parle directement au stockage.** Il faut que le stockage soit joignable depuis le client, avec une configuration CORS en prod. Une URL qui fuite reste utilisable jusqu'à son expiration, d'où la courte durée de vie. Elle ne donne accès qu'en écriture, et seulement à une clé qui n'est pas encore une révision courante.
- **Le serveur ne peut pas refuser un contenu en cours d'envoi** : un fichier qui n'est pas un DXF n'est détecté qu'au Parsing, qui passe alors le Dessin en `failed`.

## Alternatives écartées

- **Multipart via l'API** : plus simple côté client (une seule requête), mais tout le volume passe par l'API, et les limites de corps, les timeouts et la mémoire deviennent notre problème, pour aucun gain fonctionnel.
- **Upload multipart S3 présigné (par parties)** : utile au-delà de quelques Go ou pour reprendre un envoi interrompu. C'est inutile à 200 Mo, et beaucoup plus complexe (une URL par partie, puis un appel de finalisation). On le gardera en tête si la limite augmente fortement.
