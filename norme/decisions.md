# Journal des décisions

Une entrée par décision, la plus récente en haut. Format : date, décision, raison, conséquences. Les points encore ouverts sont en bas.

---

### 2026-11-23 — Plusieurs entités par personne : Entité + Périmètre (P5)
**Décision** : `Utilisateurs.Entite` reste le rattachement principal (une seule entité). On ajoute :
- `Perimetre` (liste d'entités, facultatif) : les autres entités que la personne gère ou consulte ;
- `Entites_vues` (formule) : l'entité principale + le périmètre + **toutes leurs sous-entités** (hiérarchie `Parent`).

Un **bureau est une sous-entité** (DGOM → BRC, BCL…) : pas de table Bureaux à part. Les règles d'accès s'écrivent `rec.Entite in user.Profil.Entites_vues`.
**Raison** : couvre les personnes à cheval sur plusieurs entités ou bureaux (cas d'Arrivées-Départs) sans rien casser dans les applications déjà à la norme (`Entite` est inchangée ; les deux colonnes s'ajoutent).
**Rejeté** : remplacer `Entite` par une liste (changement cassant : `Membres`, règles, widget Administration) ; garder une seule entité (chaque application réinventerait le cas).
**Conséquences** : `structure/utilisateurs.json` passe en version 1.6 ; colonnes ajoutées au Grist Gouvernance. À faire : afficher le périmètre dans le widget Administration.

### 2026-11-23 — Les widgets métier restent hors de la norme
**Décision** : la norme ne couvre que le cas général (tables du socle, principes). Les fiches et le pilotage d'Arrivées-Départs restent propres à l'application.
**Raison** : la gouvernance doit rester applicable à toutes les applications.

### 2026-11-23 — Un seul registre avec un état plutôt que des tables recopiées (P6)
**Décision** : dans Arrivées-Départs, `PersonnelParti` a été fusionnée dans `Personnel` (colonnes `parti`, `parti_le`, `valide_par`).
**Raison** : la recopie imposait deux tables identiques, des règles d'accès en double et des contrôles de cohérence (`archive_ok`, `controle_source`).
**Conséquence** : principe P6, à appliquer aux autres applications.

### 2026-11-23 — `ModifieLe` / `ModifiePar` se recalculent à chaque modification (P2)
**Décision** : `recalcWhen` = 2 pour ces deux colonnes, comme dans `structure/`.
**Raison** : dans le Grist Gouvernance elles étaient repassées en « à la création seulement » sur 5 tables, ce qui vidait la traçabilité de son sens. Corrigé dans le document ; la norme publiée était déjà juste.

### 2026-11-23 — Création du dossier `norme/`
**Décision** : les règles écrites, les décisions et les audits vivent dans ce dépôt, à côté de la structure.

---

## Points ouverts

- **Rôles métier** : comment les déclarer à côté des rôles génériques (liste ouverte dans `Role`, ou table des rôles) ?
- **Forme des noms de colonnes** : la norme mélange `Nom_complet` (mots séparés par `_`) et `CreeLe` (mots collés). Choisir une forme unique pour les nouvelles colonnes, sans renommer l'existant.
- **Attribut `user.Profil`** : renommer `user.Moi` en `user.Profil` dans les applications existantes (touche toutes les règles d'accès).
