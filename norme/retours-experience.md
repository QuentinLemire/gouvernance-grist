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

### Règles d'accès : ne pas suivre une référence
- `rec.agent.arrivee_signee` (lire une colonne d'une autre table à travers une référence) n'est pas évalué comme attendu : la règle ne s'applique jamais. Constaté sur Arrivées-Départs (le BSSIOM ne pouvait pas cocher).
- **Parade** : utiliser une colonne de formule **de la même table** (`$agent.arrivee_signee`, ou un `verrou` déjà calculé), et écrire la règle sur `rec.<cette colonne>`.

### Règles d'accès : simplifier sans rien changer
- Les règles qui se répètent dans chaque groupe de colonnes (`+U` administrateur, `-U` hors entité, `-U` final) sont déjà couvertes par les règles de la table et les règles par défaut : les retirer ne change aucun droit.
- Méthode : sauvegarder les règles (export JSON), simplifier, vérifier que l'éditeur affiche « Enregistré » sans règle invalide, puis tester **chaque rôle** en « Voir en tant que », lecture **et** écriture (une case cochée puis décochée). Arrivées-Départs : 245 → 133 règles.

### Renommer beaucoup de colonnes d'une application existante
- Préparer **d'abord** le code des widgets (copie locale), renommer ensuite, puis déployer aussitôt : la fenêtre où les fiches sont cassées reste courte.
- `RenameColumn` ne suit pas les lectures indirectes : `$group[0].nom`, `p = $agent; p.statut`. Les chercher dans toutes les formules (motif `.nom` / `$nom`) et les corriger ; ne jamais toucher `user.Email` (variable de Grist).
- Le pare-feu du serveur refuse l'envoi de code par l'API REST ; la connexion de la page Grist (`docData.sendActions`) passe, et permet de recopier un code collé une fois dans les autres sections.

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

### Widgets chargés depuis le dépôt : cache de raw.githack
- Après un commit, raw.githack peut servir l'ancienne version plusieurs minutes. Une action faite pendant ce délai (ex. publier la norme) tourne avec l'ancien code.
- **Parade** : les pages pointent sur un **commit précis** (`raw.githack.com/<compte>/<dépôt>/<commit>/widget/…`), adresse neuve donc servie tout de suite et toujours identique. Bouton Administration → Structure → « 🔄 Mettre les pages à la dernière version » après chaque évolution des widgets. « Publier la norme » vérifie aussi sa version avant d'écrire.

### Sauvegardes
- Grist garde des sauvegardes automatiques (Historique du document → Versions). Vérifier qu'il y en a une récente avant une modification lourde.
