# Synchronisation de l'annuaire (n8n)

Le workflow [`annuaire-n8n.json`](annuaire-n8n.json) tient à jour la table **Gouv_Utilisateurs** des Grist de la norme
à partir de l'annuaire d'**Arrivées-Départs** (le maître). Il tourne chaque matin à 6 h (heure de Paris), du lundi au vendredi,
et peut être lancé à la main.

```
Arrivées-Départs (Personnel_summary_Courriel, agents présents)
        │ lu par courriel
        ▼
Gouvernance, Modèle DGOM, autres applications… (Gouv_Utilisateurs)
```

## Ce qu'il fait

Chaque fiche créée par la synchro porte la case **« Ajouté par le maître »** (`Ajoute_par_maitre`, colonne de la norme dans
Gouv_Utilisateurs). La synchro ne met à jour et ne désactive **que ces fiches** : une personne ajoutée à la main dans une application
n'est jamais touchée, même si elle figure aussi dans l'annuaire.

| Cas | Action |
|---|---|
| Agent présent dans le maître, absent de l'application | Ajouté : Nom (« Prénom NOM »), Courriel, Entité, Fonction (si la colonne existe), Actif, **Ajouté par le maître** coché. **Sans rôle** : il ne voit que l'accueil tant qu'un administrateur ne lui en donne pas un. |
| Fiche cochée, agent toujours présent | Nom, Entité et Fonction mis à jour depuis le maître. **Le rôle n'est jamais touché.** |
| Fiche cochée, agent absent du maître (parti) | Désactivée (jamais supprimée). |
| Fiche cochée et désactivée, agent revenu | Réactivée. |
| Fiche non cochée (ajoutée à la main) | Rien. Décocher la case d'une fiche la sort de la synchro ; la cocher l'y fait entrer. |

L'entité est cherchée par son nom dans `Gouv_Entites` : d'abord le bureau (ex. BSSIOM), sinon la direction (ex. DGOM).
Introuvable : l'entité de la fiche n'est pas modifiée.

**Sécurités** : annuaire vide → arrêt ; plus de `desactivationsMax` départs d'un coup (10 par défaut) → aucun départ appliqué,
le résumé le signale ; mode **essai** (activé à l'import) → tout est calculé, rien n'est écrit.

## Mise en place

1. **Colonne « Ajouté par le maître »** : dans chaque application cible, Administration › Maintenance › Utilisateurs
   « Installer » (ajoute la colonne qui manque). Sans elle, la synchro s'arrête avec un message pour cette application.
2. **Compte Grist de la synchro** (de préférence un compte de service) et sa clé d'API. Lui donner accès :
   - au maître (Arrivées-Départs), en lecture de `Personnel_summary_Courriel` ;
   - à chaque application cible, comme **propriétaire** : les règles de la norme ne laissent voir que l'accueil
     à une personne non inscrite dans Gouv_Utilisateurs ; seuls les propriétaires passent outre.
   Arrivées-Départs applique la même garde : le compte doit y être propriétaire, ou inscrit avec un rôle qui lit tout le personnel.
3. **n8n** : *Import from file* → `annuaire-n8n.json`. Créer un identifiant **Grist API** : la clé d'API du compte
   et l'adresse `https://grist.numerique.gouv.fr` (champ *Grist URL* ; sur une ancienne version de n8n, *Self-Hosted* puis
   *Self-Hosted URL*). Le choisir dans les 5 nœuds Grist.
4. **Réglages** (premier nœud de code, le seul à modifier) : vérifier le maître, ajouter une ligne par application cible.
5. **Essai** : « Lancer à la main », lire le nœud **Résumé** (une ligne par application).
   Si c'est juste, passer `essai: false` dans les Réglages et activer le workflow.

## Comment il est construit

Tout passe par les **nœuds Grist** de n8n (lire, ajouter, mettre à jour des lignes) et quelques nœuds de code commentés.
Le nœud Grist ne lit le document qu'une fois par exécution : les applications cibles sont donc traitées **une à la fois**
(nœud « Une cible à la fois »). Pour chacune : lire les entités et les utilisateurs, calculer les changements, ajouter, mettre à jour,
puis passer à la suivante. Le filtre « agents présents » est fait dans le code, car le filtre du nœud Grist ne sait pas lire une case à cocher.

## Colonnes attendues

- **Maître** (`Personnel_summary_Courriel`) : `Courriel`, `Prenom`, `Nom`, `Bureau`, `Entite`, `Fonction`, `Present`.
  Sans colonne `Present` cochée, aucun agent n'est gardé et la synchro s'arrête ; un autre nom laisse le champ vide : adapter le nœud « Préparer les agents ».
- **Cible** : la table `Gouv_Utilisateurs` de la norme (`Nom`, `Courriel`, `Entite`, `Actif`, `Ajoute_par_maitre`) et `Gouv_Entites` (`Nom`).
  `Fonction` est facultative : elle n'est remplie que si l'application a cette colonne.

Si une application cible n'a pas ces tables, le nœud Grist échoue et la synchro s'arrête : installer le socle d'abord
(Administration › Maintenance).
