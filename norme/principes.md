# Principes de la norme

Chaque principe a un identifiant (P1, P2…) pour y renvoyer depuis les audits et les décisions.

## P1 — Socle de tables standard
**Socle** (présent dans toute application) : **Utilisateurs & Entités**, **Accueil** (avec **Paramètres**, que la page d'accueil lit : nom de l'application, contact, logo) et **Journal_Admin**.
**Hors socle** (bouton « Installer » dans Administration → Structure) : **Support** (+ Support_commentaires), **Documentation**, **Territoires** (qui ajoute aussi la colonne `Entites.Territoire`).
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
- Tables et colonnes : première lettre en majuscule, sans accent ni espace (`Nom`, `Nom_complet`, `Courriel_cle`). Le libellé affiché, lui, est en français normal.
- Noms en français : une adresse électronique s'appelle **`Courriel`** (`Courriel`, `Courriel_pro`, `Courriel_cle`), jamais `Email` ni `Mail`. Seule la variable Grist `user.Email`, qu'on ne peut pas renommer, garde son nom dans les formules.
- Les colonnes de traçabilité gardent leur forme historique `CreeLe`, `CreePar`, `ModifieLe`, `ModifiePar` (voir les points ouverts de `decisions.md`).
- Une colonne Référence porte le nom de ce qu'elle désigne (`Entite`, `Demandeur`), pas `id_…`.
- **Portée** : **toutes** les colonnes, métier comprises (décision du 2026-11-23 : plus de tolérance). Une application existante renomme ses colonnes (`RenameColumn` : Grist met à jour formules et règles d'accès) et adapte en même temps le code de ses widgets. Seules exceptions : les colonnes techniques de Grist (`manualSort`, `gristHelper_…`, `group` des tables de résumé).

## P4 — Ordre des colonnes
D'abord ce qui identifie la ligne, puis le contenu, les liens, l'état, et en dernier la traçabilité.

## P5 — Droits par rôle
- Le rôle vient de la table Utilisateurs, via l'attribut utilisateur **`user.Profil`**.
- Rôles génériques : **Administrateur, Gestionnaire, Contributeur, Lecteur**, présents dans toute application.
- **Rôles métier** : une application peut en ajouter (ex. Chef de bureau, BSSIOM) dans la même liste `Role`. Ils sont officiels dès qu'ils sont décrits dans son fichier `applications/…` (qui fait quoi, sur quel périmètre).
- Une personne non inscrite ou inactive ne voit **que la page d'accueil**.
- **Périmètre** : `Entite` = rattachement principal ; `Perimetre` = autres entités gérées (facultatif) ; `Entites_vues` (calculée) = les deux avec toutes leurs sous-entités. Un bureau est une sous-entité (`Parent`). Règle d'accès type : `rec.Entite in user.Profil.Entites_vues`.

## P6 — Un seul registre, des états
Un même objet (un agent, un dossier…) vit dans **une seule table**, avec une colonne d'état (`Parti`, `Archive`…), plutôt que d'être recopié d'une table à l'autre.
Les pages filtrent selon l'état. Cela évite les doublons de colonnes et les contrôles de recopie.

## P7 — Widgets
- Les widgets **génériques** (Accueil, Documentation, Support, Administration, Boîte à outils) sont chargés **par URL** depuis ce dépôt, jamais collés dans le document.
- Pages du **socle** : Accueil, Administration (› Utilisateurs, Boîte à outils). Pages **hors socle** : Documentation et Support, rangées sous l'Accueil, créées par leur bouton « Installer » (qui installe aussi leurs tables).
- Les widgets **métier** peuvent rester collés dans le document (« Custom widget builder »), à une condition : **un seul code par widget**. Les variantes passent par un réglage (ex. `<body data-type="…">`), jamais par des copies modifiées ; toute correction est reportée à l'identique sur chaque page qui l'utilise.
- Les héberger dans un dépôt reste possible, mais n'est pas exigé (le code métier n'a pas vocation à être public).

## P8 — Rien n'est supprimé
La mise à la norme ajoute ce qui manque et range les colonnes ; elle ne supprime aucune donnée.
