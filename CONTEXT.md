# Contexte du domaine

Glossaire du visualiseur DXF. Ces termes sont employés tels quels dans le code, les tickets, les tests et l'API.

## Glossaire

**Dessin**
: Un plan DXF appartenant à un Propriétaire. Il réunit un nom, une description facultative, un Statut, et au plus une révision courante (le Fichier source et son Dessin parsé). C'est la ressource `drawing` de l'API.

**Fichier source**
: Le fichier DXF d'origine, tel que l'utilisateur l'a envoyé. Il est déposé directement dans le stockage objet via une URL présignée, sans transiter par l'API. Le serveur ne le modifie jamais.

**Dessin parsé**
: La représentation prête à afficher, produite par le Parsing d'un Fichier source : métadonnées (version DXF, unités, emprise, compteurs), calques, définitions de blocs et entités de l'espace objet. Les insertions de blocs référencent leur bloc par son nom, sans expansion à plat. Il est stocké en JSON dans le stockage objet.

**Résumé**
: La vue légère d'un Dessin, renvoyée par les listes et les consultations : nom, description, Statut, erreur éventuelle, taille, dates, version DXF, unités, emprise, calques et compteurs par type d'entité. Il ne contient pas la géométrie.

**Propriétaire**
: L'utilisateur qui a créé un Dessin. Lui seul peut le voir, le modifier ou le supprimer. Pour tout autre utilisateur, le Dessin n'existe pas (404).

**Parsing**
: Le traitement asynchrone, exécuté par le worker, qui lit un Fichier source, le valide et en produit le Dessin parsé. Un DXF invalide est un échec définitif ; une panne d'infrastructure est retentée.

**Remplacement**
: L'envoi d'un nouveau Fichier source pour un Dessin existant. La révision courante reste servie pendant le Parsing du nouveau fichier. Si le Parsing réussit, la nouvelle révision remplace l'ancienne, dont les objets sont supprimés du stockage. S'il échoue, l'ancienne révision est conservée et seul le champ erreur est rempli. Il n'y a pas d'historique de versions.

**Statut**
: L'étape du cycle de vie d'un Dessin : `awaiting_upload` (en attente d'upload), `queued` (en file), `parsing` (Parsing en cours), `ready` (prêt), `failed` (échec). Chaque changement de Statut est diffusé en temps réel au Propriétaire.
