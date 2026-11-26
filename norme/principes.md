# Principes de la norme

Chaque principe a un identifiant (P1, P2…) pour y renvoyer depuis les audits et les décisions.

## P1 — Socle de tables standard
**Socle** (présent dans toute application) : **Utilisateurs & Entités**, **Accueil** (avec **Paramètres**, que la page d'accueil lit : nom de l'application, contact, logo). Le **Journal** (trace des actions d'administration) est un module à installer si l'application a besoin d'un audit.
**Hors socle** (bouton « Installer » dans la Maintenance) : **Support** (+ Support_commentaires), **Documentation**, **Territoires** (qui ajoute aussi la colonne `Entites.Territoire`).
Les colonnes propres à l'application **s'ajoutent après** celles de la norme ; on ne renomme ni ne retire une colonne de la norme.
**Application existante qui a déjà son registre des personnes** (ex. OPCOM : table `Utilisateurs`, plusieurs rôles par personne) : elle **le garde**, la norme s'y adapte. Le registre est celui que désigne l'attribut utilisateur de ses règles d'accès (ex. `user.Permission` → `Utilisateurs`) ; `Gouv_Utilisateurs`, `Gouv_Entites` et la page 👥 Utilisateurs de la norme ne sont alors ni exigées ni créées. La table est déclarée dans **Paramètres** (clé `Table_utilisateurs`, posée par la Maintenance) pour la page d'accueil. Le reste du socle (Paramètres, Accueil) s'installe normalement.

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
- L'identifiant d'une colonne est **détaché de son libellé** : on peut retoucher le libellé sans renommer la colonne (et sans casser formules, règles et widgets).
- **Repérage dans « Données source »** : les tables de la norme portent un emoji devant leur nom — 🧱 socle, 🧩 module installé — posé par l'installateur ; les tables propres à l'application (métier, référentiel) gardent leur nom seul. ⚠️ Dans Grist, modifier le titre d'une table la renomme : le titre doit rester « emoji + nom exact ».
- Une colonne Référence porte le nom de ce qu'elle désigne (`Entite`, `Demandeur`), pas `id_…`.
- **Portée** : **toutes** les colonnes, métier comprises (décision du 2026-11-23 : plus de tolérance). Une application existante renomme ses colonnes (`RenameColumn` : Grist met à jour formules et règles d'accès) et adapte en même temps le code de ses widgets. Seules exceptions : les colonnes techniques de Grist (`manualSort`, `gristHelper_…`, `group` des tables de résumé).

## P4 — Ordre des colonnes
D'abord ce qui identifie la ligne, puis le contenu, les liens, l'état, et en dernier la traçabilité.

## P5 — Droits par rôle
- Le rôle vient de la table Utilisateurs, via l'attribut utilisateur **`user.Profil`** (ou celui du registre propre à l'application, voir P1).
- Rôles génériques : **Administrateur, Gestionnaire, Contributeur, Lecteur**, présents dans toute application qui utilise le registre de la norme. Une application qui garde son registre garde aussi ses rôles ; le ou les rôles qui l'administrent sont déclarés dans **Paramètres** (clé `Roles_administration`, ex. « AdminDGOM »).
- **Un ou plusieurs rôles par personne** : colonne `Role` en choix simple (règle `user.Profil.Role == "Gestionnaire"`) ou en choix multiples (règle `"Gestionnaire" in user.Profil.Role`). Les outils d'administration écrivent la bonne forme d'eux-mêmes.
- **Rôles métier** : une application peut en ajouter (ex. Chef de bureau, BSSIOM) dans la même liste `Role`. Ils sont officiels dès qu'ils sont décrits dans son fichier `applications/…` (qui fait quoi, sur quel périmètre).
- Une personne non inscrite ou inactive ne voit **que la page d'accueil**.
- **Périmètre** : `Entite` = rattachement de la personne ; `Entites_vues` (calculée) = cette entité avec toutes ses sous-entités. Voir d'autres entités se donne dans les règles d'accès (🔐 Rôles et droits), pas par une colonne. Un bureau est une sous-entité (`Parent`). Règle d'accès type : `rec.Entite in user.Profil.Entites_vues`.

## P6 — Un seul registre, des états
Un même objet (un agent, un dossier…) vit dans **une seule table**, avec une colonne d'état (`Parti`, `Archive`…), plutôt que d'être recopié d'une table à l'autre.
Les pages filtrent selon l'état. Cela évite les doublons de colonnes et les contrôles de recopie.

## P7 — Widgets
- Les widgets **génériques** (Accueil, Documentation, Support, outils d'administration) sont chargés **par URL** depuis ce dépôt, jamais collés dans le document.
- Pages du **socle** : Accueil, Administration (santé du document › Utilisateurs, Rôles et droits, Explorateur, Atelier, Maintenance, Aide). La page Utilisateurs n'est pas créée quand l'application garde son registre (P1). Toutes les pages du socle sont présentes dans chaque application. Pages **hors socle** : Documentation et Support, rangées sous l'Accueil, et Journal, sous Administration, créées par leur bouton « Installer » (qui installe aussi leurs tables).
- Les widgets **métier** peuvent rester collés dans le document (« Custom widget builder »), à une condition : **un seul code par widget**. Les variantes passent par un réglage (ex. `<body data-type="…">`), jamais par des copies modifiées ; toute correction est reportée à l'identique sur chaque page qui l'utilise.
- Les héberger dans un dépôt reste possible, mais n'est pas exigé (le code métier n'a pas vocation à être public).
- Les widgets de la **galerie Grist** (Markdown, Graphique, Tableau croisé dynamique, Vue groupée…), choisis dans la liste des widgets, sont admis : leur code est public et maintenu par leur auteur. Grist n'enregistre pas leur adresse, seulement leur identifiant (`widgetId`) : les outils les reconnaissent comme tels.
- Tout autre widget chargé par adresse (hors dépôt de la norme et galerie) est **recensé** par la santé du document, pour savoir d'où vient le code. L'ancienne Boîte à outils (`balludgom.github.io/TableManager`) est remplacée par la console d'administration.

## P8 — Rien n'est supprimé
La mise à la norme ajoute ce qui manque et range les colonnes ; elle ne supprime aucune donnée.
