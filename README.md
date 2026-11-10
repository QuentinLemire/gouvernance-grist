# Norme DGOM des applications Grist — Ministère des Outre-mer

Ce dépôt décrit **les tables et les principes communs** à toutes les applications Grist de la DGOM, et les widgets qui vont avec.
Le Grist **« Gouvernance »** en est la base source ; le Grist **« Modèle DGOM »** est le point de départ de toute nouvelle application.

## Les tables standard (`structure/`)

| Fichier | Tables | Rôle |
|---|---|---|
| `utilisateurs.json` | Entites, Utilisateurs | Annuaire et rôles génériques (Administrateur, Gestionnaire, Contributeur, Lecteur) ; base des droits |
| `referentiel_territoires.json` | Territoires | Référentiel facultatif des 13 territoires ultramarins (codes COG, données dans `donnees/`) |
| `parametres.json` | Parametres | Nom de l'application, contact, logo DGOM |
| `accueil_public.json` | Accueil | Message affiché aux personnes sans droit |
| `support.json` | Support, Support_commentaires | Demandes et conversation avec le support |
| `journal.json` | Journal_Admin | Trace des actions d'administration |
| `documentation.json` | Documentation | Guides, procédures, FAQ, notes et nouveautés en Markdown |

Chaque fichier ne contient que la structure (tables, colonnes, types, formules), jamais de données.

## Les principes

- **Traçabilité** : toute table métier a les colonnes `CreeLe`, `CreePar`, `ModifieLe`, `ModifiePar`.
- **Droits par rôle** : le rôle vient de la table Utilisateurs (attribut `user.Profil`) ; une personne non inscrite ou inactive ne voit que l'accueil.
- **Rien n'est supprimé** : mettre une application à la norme ajoute seulement ce qui manque.

## Les widgets (`widget/`)

Pour chacun : ajouter une page → **Personnalisée** → **URL personnalisée**, niveau d'accès **Accès complet au document**.

| Page | Table liée | Fichier | Rôle |
|---|---|---|---|
| Accueil | Accueil | `accueil.html` | Accès réservé pour les non-inscrits ; accueil, nouveautés et documentation pour les autres |
| Documentation | Documentation | `documentation.html` | Sommaire, recherche, pages Markdown, édition avec aperçu |
| Support | Support | `support.html` | Créer une demande et converser avec le support |
| Administration | (aucune) | `administration.html` | Utilisateurs, droits, support (clore / rouvrir), mise à la norme, paramètres, journal, aide |
| Boîte à outils | Parametres | `boite-a-outils.html` | Outil de Florent Ballu ([TableManager](https://github.com/balludgom/TableManager)) : schéma, gestion des tables et colonnes |

Adresse : `https://raw.githack.com/QuentinLemire/gouvernance-grist/main/widget/<fichier>`
(ou `https://quentinlemire.github.io/gouvernance-grist/widget/<fichier>` une fois GitHub Pages activé).

Le logo DGOM se règle dans **Parametres**, clé `Logo_DGOM` (adresse d'une image publique).

## Créer ou mettre à la norme une application

- **Nouvelle application** : dupliquer le Grist « Modèle DGOM ».
- **Application existante** : poser le widget Administration, onglet **Structure**, puis « Installer » sur chaque table standard manquante ou incomplète.
- **Par script** : console du navigateur (F12) sur le document, coller `scripts/installer-gouvernance.js` puis
  `await installerGouvernance(['utilisateurs', 'parametres', 'accueil_public', 'support', 'journal', 'documentation'])`.

## Faire évoluer la norme

Modifier le fichier concerné dans `structure/`, augmenter sa `version`, puis appliquer la mise à la norme dans les applications.
