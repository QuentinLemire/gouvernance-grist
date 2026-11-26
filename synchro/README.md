# Synchronisation de l'annuaire (n8n)

Le workflow [`annuaire-n8n.json`](annuaire-n8n.json) tient à jour la table **Gouv_Utilisateurs** des Grist de la norme
à partir de l'annuaire d'**Arrivées-Départs** (le maître). Il tourne chaque matin à 6 h (heure de Paris), du lundi au vendredi,
et peut être lancé à la main.

```
Arrivées-Départs (Personnel_summary_Courriel : une ligne par agent présent)
        │ lu par courriel
        ▼
tous les Grist dont le compte de la synchro est propriétaire
et qui ont Gouv_Utilisateurs avec la case « Ajouté par le maître »
```

**Aucune liste d'applications à tenir** : à chaque passage, n8n parcourt les organisations et les espaces que le compte voit,
garde les documents dont il est **propriétaire** (sauf le maître), puis ceux dont la table Gouv_Utilisateurs a la colonne
« Ajouté par le maître ». Les autres sont ignorés sans erreur. Pour faire entrer une application dans la synchro : y installer
la colonne et donner au compte l'accès propriétaire. Pour l'en sortir : retirer cet accès, ou mettre son identifiant dans `exclure`.

## Ce qu'il fait

Chaque fiche créée par la synchro porte la case **« Ajouté par le maître »** (`Ajoute_par_maitre`, colonne de la norme dans
Gouv_Utilisateurs). La synchro ne met à jour et ne supprime **que ces fiches** : une personne ajoutée à la main dans une application
n'est jamais touchée, même si elle figure aussi dans l'annuaire.

| Cas | Action |
|---|---|
| Agent dans l'annuaire, absent de l'application | Ajouté : Nom (« Prénom NOM »), Courriel, Entité, Fonction (si la colonne existe), Actif, **Ajouté par le maître** coché. **Sans rôle** : il ne voit que l'accueil tant qu'un administrateur ne lui en donne pas un. |
| Fiche cochée, agent toujours dans l'annuaire | Nom, Entité et Fonction mis à jour depuis le maître. **Le rôle et la case Actif ne sont jamais touchés.** |
| Fiche cochée, agent sorti de l'annuaire (parti) | **Supprimée.** S'il revient, une nouvelle fiche est créée, sans rôle. |
| Fiche non cochée (ajoutée à la main) | Rien. Décocher la case d'une fiche la sort de la synchro ; la cocher l'y fait entrer. |

L'entité est cherchée par son nom dans `Gouv_Entites` : d'abord le bureau (ex. BSSIOM), sinon la direction (ex. DGOM).
Introuvable : l'entité de la fiche n'est pas modifiée.

Une fiche supprimée laisse vides les références qui la visaient (auteur d'une demande de support, d'une page de documentation…) ;
les courriels bruts (`Demandeur`, `CreePar`) restent.

**Sécurités** : annuaire vide → arrêt ; plus de `suppressionsMax` départs d'un coup (10 par défaut) → aucune suppression,
le résumé le signale ; mode **essai** (activé à l'import) → tout est calculé, rien n'est écrit.

## Mise en place

1. **Colonne « Ajouté par le maître »** : dans chaque application à synchroniser, Administration › Maintenance › Utilisateurs
   « Installer » (ajoute la colonne qui manque). Sans elle, l'application est ignorée.
2. **Compte Grist de la synchro** (de préférence un compte de service) et sa clé d'API. Lui donner accès :
   - au maître (Arrivées-Départs), en lecture de `Personnel_summary_Courriel` ;
   - à chaque application à synchroniser, comme **propriétaire** : c'est ce qui la désigne comme cible ; et les règles de la norme
     ne laissent voir que l'accueil à une personne non inscrite dans Gouv_Utilisateurs (seuls les propriétaires passent outre).
   Arrivées-Départs applique la même garde : le compte doit y être propriétaire, ou inscrit avec un rôle qui lit tout le personnel.
3. **n8n** : *Import from file* → `annuaire-n8n.json`. Créer un identifiant **Grist API** : la clé d'API du compte
   et l'adresse `https://grist.numerique.gouv.fr` (champ *Grist URL* ; sur une ancienne version de n8n, *Self-Hosted* puis
   *Self-Hosted URL*). Le choisir dans les 6 nœuds Grist.
   Créer aussi un identifiant **Header Auth** (nom `Authorization`, valeur `Bearer <la même clé>`) pour les 3 nœuds HTTP
   qui cherchent les documents : le nœud Grist ne sait pas lister les organisations, les espaces ni les colonnes.
4. **Réglages** (premier nœud de code, le seul à modifier) : adresse du Grist, maître, éventuelles exclusions.
5. **Essai** : « Lancer à la main », lire le nœud **Résumé** (une ligne par application).
   Si c'est juste, passer `essai: false` dans les Réglages et activer le workflow.

## Comment il est construit

Recherche des cibles : 3 nœuds HTTP (`/api/orgs`, `/api/orgs/{id}/workspaces`, colonnes de Gouv_Utilisateurs), dont les erreurs
(organisation illisible, document sans la table) sont ignorées. Lecture et écriture des données : **nœuds Grist** de n8n
(lire, ajouter, mettre à jour, supprimer des lignes). Le reste : quelques nœuds de code commentés.
Le nœud Grist ne lit le document qu'une fois par exécution : les applications cibles sont donc traitées **une à la fois**
(nœud « Une cible à la fois »). Pour chacune : lire les entités et les utilisateurs, calculer les changements, ajouter, mettre à jour, supprimer,
puis passer à la suivante.

## Colonnes attendues

- **Maître** (`Personnel_summary_Courriel`) : `Courriel`, `Prenom`, `Nom`, `Bureau`, `Entite`, `Fonction`.
  **Toute ligne de l'annuaire est un agent présent** : la table ne doit contenir que le personnel présent.
  Une colonne au nom différent laisse le champ vide : adapter le nœud « Préparer les agents ».
- **Cible** : la table `Gouv_Utilisateurs` de la norme (`Nom`, `Courriel`, `Entite`, `Actif`, `Ajoute_par_maitre`) et `Gouv_Entites` (`Nom`) ; sans `Gouv_Entites`, l'entité n'est pas remplie.
  `Fonction` est facultative : elle n'est remplie que si l'application a cette colonne.

