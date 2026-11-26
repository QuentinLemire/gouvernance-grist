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

| Cas | Action |
|---|---|
| Agent présent dans le maître, absent de l'application | Ajouté : Nom (« Prénom NOM »), Courriel, Entité, Fonction (si la colonne existe), Actif. **Sans rôle** : il ne voit que l'accueil tant qu'un administrateur ne lui en donne pas un. |
| Agent présent des deux côtés | Nom, Entité et Fonction mis à jour depuis le maître. **Le rôle n'est jamais touché.** |
| Personne de l'application absente du maître (agent parti) | Désactivée, **seulement si c'est la synchro qui l'a créée** (`CreePar` = le compte de service). Les personnes ajoutées à la main ne sont jamais désactivées. |
| Agent parti puis revenu | Sa fiche créée par la synchro est réactivée. |

L'entité est cherchée par son nom dans `Gouv_Entites` : d'abord le bureau (ex. BSSIOM), sinon la direction (ex. DGOM).
Introuvable : l'entité de la fiche n'est pas modifiée.

**Sécurités** : annuaire vide → arrêt ; plus de `desactivationsMax` départs d'un coup (10 par défaut) → aucun départ appliqué,
le résumé le signale ; mode **essai** (activé à l'import) → tout est calculé, rien n'est écrit.

## Mise en place

1. **Compte de service Grist** : en créer un (le courriel finit par `@serviceaccounts.invalid`, c'est ce qui permet de
   reconnaître les fiches créées par la synchro) et générer sa clé d'API.
2. **Lui donner accès** :
   - au maître (Arrivées-Départs), en lecture de `Personnel_summary_Courriel` ;
   - à chaque application cible, comme **propriétaire** : les règles de la norme ne laissent voir que l'accueil
     à une personne non inscrite dans Gouv_Utilisateurs ; seuls les propriétaires passent outre.
   Arrivées-Départs applique la même garde : le compte doit y être propriétaire, ou inscrit avec un rôle qui lit tout le personnel.
3. **n8n** : *Import from file* → `annuaire-n8n.json`. Créer un identifiant *Header Auth* :
   nom `Authorization`, valeur `Bearer <clé d'API>`, et le choisir dans les 7 nœuds HTTP.
4. **Réglages** (premier nœud de code, le seul à modifier) : vérifier le maître, ajouter une ligne par application cible.
5. **Essai** : « Lancer à la main », lire le résumé du nœud « Calculer les changements ».
   Si c'est juste, passer `essai: false` dans les Réglages et activer le workflow.

## Colonnes attendues

- **Maître** (`Personnel_summary_Courriel`) : `Courriel`, `Prenom`, `Nom`, `Bureau`, `Entite`, `Fonction`, `Present`.
  Un nom différent fait échouer la lecture (filtre `Present`) ou laisse le champ vide : adapter le nœud « Préparer les agents ».
- **Cible** : la table `Gouv_Utilisateurs` de la norme (`Nom`, `Courriel`, `Entite`, `Actif`, `CreePar`) et `Gouv_Entites` (`Nom`).
  `Fonction` est facultative : elle n'est remplie que si l'application a cette colonne.

Si une application cible n'a pas ces tables, le nœud HTTP échoue et la synchro s'arrête : installer le socle d'abord
(Administration › Maintenance).
