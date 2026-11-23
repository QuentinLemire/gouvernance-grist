# Journal des décisions

Une entrée par décision, la plus récente en haut. Format : date, décision, raison, conséquences. Les points encore ouverts sont en bas.

---

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

- **Plusieurs entités par utilisateur** : la norme prévoit une seule `Entite` par utilisateur ; Arrivées-Départs a besoin de plusieurs entités et de plusieurs bureaux par personne. Faut-il ajouter à la norme une colonne `Entites` (liste) ? *À trancher avant de mettre Entites/Utilisateurs d'Arrivées-Départs à la norme.*
- **Rôles métier** : comment les déclarer à côté des rôles génériques (liste ouverte dans `Role`, ou table des rôles) ?
- **Forme des noms de colonnes** : la norme mélange `Nom_complet` (mots séparés par `_`) et `CreeLe` (mots collés). Choisir une forme unique pour les nouvelles colonnes, sans renommer l'existant.
- **Attribut `user.Profil`** : renommer `user.Moi` en `user.Profil` dans les applications existantes (touche toutes les règles d'accès).
