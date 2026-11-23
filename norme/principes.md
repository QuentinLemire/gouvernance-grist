# Principes de la norme

Chaque principe a un identifiant (P1, P2…) pour y renvoyer depuis les audits et les décisions.

## P1 — Socle de tables standard
Toute application contient les tables du socle (`../structure/`) : **Territoires, Entites, Utilisateurs, Parametres, Accueil, Support, Support_commentaires, Journal_Admin**. `Documentation` est facultative.
Les colonnes propres à l'application **s'ajoutent après** celles de la norme ; on ne renomme ni ne retire une colonne de la norme.

## P2 — Traçabilité
Toute table métier a, en dernier :

| Colonne | Type | Formule | Recalcul |
|---|---|---|---|
| `CreeLe` | DateTime | `NOW()` | à la création (`recalcWhen` 0) |
| `CreePar` | Text | `user.Email` | à la création (`recalcWhen` 0) |
| `ModifieLe` | DateTime | `NOW()` | **à chaque modification** (`recalcWhen` 2) |
| `ModifiePar` | Text | `user.Email` | **à chaque modification** (`recalcWhen` 2) |

## P3 — Nommage
- Tables et colonnes : première lettre en majuscule, sans accent ni espace (`Nom`, `Nom_complet`, `Email_cle`). Le libellé affiché, lui, est en français normal.
- Les colonnes de traçabilité gardent leur forme historique `CreeLe`, `CreePar`, `ModifieLe`, `ModifiePar` (voir les points ouverts de `decisions.md`).
- Une colonne Référence porte le nom de ce qu'elle désigne (`Entite`, `Demandeur`), pas `id_…`.

## P4 — Ordre des colonnes
D'abord ce qui identifie la ligne, puis le contenu, les liens, l'état, et en dernier la traçabilité.

## P5 — Droits par rôle
- Le rôle vient de la table Utilisateurs, via l'attribut utilisateur **`user.Profil`**.
- Rôles génériques : **Administrateur, Gestionnaire, Contributeur, Lecteur**. Une application peut ajouter des rôles métier, documentés dans son fichier `applications/…`.
- Une personne non inscrite ou inactive ne voit **que la page d'accueil**.
- **Périmètre** : `Entite` = rattachement principal ; `Perimetre` = autres entités gérées (facultatif) ; `Entites_vues` (calculée) = les deux avec toutes leurs sous-entités. Un bureau est une sous-entité (`Parent`). Règle d'accès type : `rec.Entite in user.Profil.Entites_vues`.

## P6 — Un seul registre, des états
Un même objet (un agent, un dossier…) vit dans **une seule table**, avec une colonne d'état (`Parti`, `Archive`…), plutôt que d'être recopié d'une table à l'autre.
Les pages filtrent selon l'état. Cela évite les doublons de colonnes et les contrôles de recopie.

## P7 — Widgets
- Les widgets **génériques** (Accueil, Documentation, Support, Administration, Boîte à outils) sont chargés **par URL** depuis ce dépôt, jamais collés dans le document.
- Les widgets **métier** peuvent vivre dans l'application, mais **un seul code par widget** : les variantes passent par un réglage (ex. `<body data-type="…">`), pas par des copies modifiées.

## P8 — Rien n'est supprimé
La mise à la norme ajoute ce qui manque et range les colonnes ; elle ne supprime aucune donnée.
