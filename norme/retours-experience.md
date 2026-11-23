# Retours d'expérience techniques

Les pièges rencontrés sur grist.numerique.gouv.fr, et la façon de les éviter.

### Pare-feu (WAF) de grist.numerique.gouv.fr
- L'API REST renvoie **403** sur certaines requêtes : `/sql` avec sous-requête, et `/apply` contenant certains codes de widget (même inchangés).
- **Conséquence** : un code de widget collé dans le document ne peut pas toujours être mis à jour par l'API ; il faut passer par l'éditeur du widget.
- **Parade durable** : héberger les widgets dans ce dépôt et les charger par URL (P7).

### Moteur de calcul bloqué
- Après un ajout de colonne raté (colonne à recalcul déclenché créée par l'API), **toute modification de structure** échoue avec `TypeError 'AltText' object is not iterable`, sur toutes les tables.
- **Réparation** : recharger le document côté serveur (propriétaire) : `POST /api/docs/<id>/force-reload` avec les en-têtes `Content-Type: application/json` et `X-Requested-With: XMLHttpRequest`. Les modifications faites pendant la panne peuvent être perdues : les vérifier.
- **Prévention** : créer la colonne simple d'abord, régler son recalcul ensuite ; tester une table avant de traiter les autres.

### Installateur sur une application existante
- Les sujets Support, Journal et Documentation **dépendent** des Utilisateurs de la norme : les installer ajoute `Email`, `Nom`… à une table Utilisateurs qui a peut-être déjà `email`, `nom`… (doublons à la casse près).
- Installer `utilisateurs` **avec** `accueil_public` pose aussi les règles de base (`user.Profil`, « non inscrits : Accueil seulement ») par-dessus les règles existantes.
- **Méthode** : sur une application qui a déjà ses utilisateurs et ses droits, installer d'abord seulement `referentiel_territoires`, `parametres`, `accueil_public` (aucune règle posée), ajouter la traçabilité, puis traiter Entites / Utilisateurs à part.
- Les colonnes de traçabilité ajoutées après coup sont vides pour les lignes existantes : reprendre ce qui existe (ex. `cree_le`), ne rien inventer.

### Règles d'accès : pas de méthodes Python
- Une formule comme `rec.Cle.endswith("_jeton")` est acceptée à l'enregistrement, mais Grist ne sait pas l'évaluer : la règle passe en erreur et **bloque toute la table, propriétaires compris**.
- **Parade** : comparaisons simples, `in` sur une liste explicite (`rec.Cle in ["Github_jeton", "Gitlab_jeton"]`), `and` / `or` / `not`. Après chaque nouvelle règle, relire la table avec un compte propriétaire.

### Renommer des colonnes
- `RenameColumn` met à jour **toutes les formules et toutes les règles d'accès** (y compris `user.<attribut>.<colonne>` et la colonne de recherche de l'attribut). Le code des widgets, lui, est à adapter à la main.
- Vérifier ensuite les formules d'affichage (`$ref.colonne`) et les tables de résumé.

### Éditeur de règles « Invalide »
- Une règle **sans condition** dans les règles par défaut, suivie des règles intégrées de Grist, met l'éditeur en « Invalide » (le moteur, lui, l'applique). Écrire `True` à la place d'une condition vide.

### L'installateur et les tables nouvelles
- `AddTable` ignore le réglage de recalcul des colonnes : sans correction, `ModifieLe` / `ModifiePar` ne sont remplis qu'à la création. Corrigé le 2026-11-23 dans l'installateur et le widget Administration ; à contrôler avec le script d'audit (P2).

### Tester les droits
- Permissions avancées → **« Voir en tant que »** : on voit le menu et les données exactement comme un utilisateur donné. À faire pour chaque rôle après une modification des règles.

### Widgets copiés en plusieurs exemplaires
- Un même code collé dans plusieurs pages diverge vite et chaque correction doit être faite N fois. Voir P7.

### Sauvegardes
- Grist garde des sauvegardes automatiques (Historique du document → Versions). Vérifier qu'il y en a une récente avant une modification lourde.
