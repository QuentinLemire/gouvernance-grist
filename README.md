# Norme DGOM des applications Grist — Ministère des Outre-mer

Ce dépôt décrit **les tables et les principes communs** à toutes les applications Grist de la DGOM, et les widgets qui vont avec.
Le Grist **« Gouvernance »** en est la base source ; le Grist **« Modèle DGOM »** est le point de départ de toute nouvelle application.

## Les tables standard (`structure/`)

| Fichier | Tables | Rôle |
|---|---|---|
| `utilisateurs.json` | Entites, Utilisateurs | Annuaire et rôles génériques (Administrateur, Gestionnaire, Contributeur, Lecteur) ; base des droits |
| `referentiel_territoires.json` | Territoires | Les 13 territoires ultramarins (codes COG, données dans `donnees/`) ; chaque entité y est rattachée |
| `parametres.json` | Parametres | Nom de l'application, contact, logo DGOM |
| `accueil_public.json` | Accueil | Message affiché aux personnes sans droit |
| `support.json` | Support, Support_commentaires | Demandes et conversation avec le support |
| `journal.json` | Journal_Admin | Trace des actions d'administration |
| `documentation.json` | Documentation | Guides, procédures, FAQ, notes et nouveautés en Markdown |

Chaque fichier ne contient que la structure (tables, colonnes, types, formules), jamais de données.

### Comment les tables sont liées

```
Territoires ◄── Entites ◄── Utilisateurs ◄──┬── Support ◄── Support_commentaires
                  ▲ │ (Parent)               ├── Support_commentaires.Auteur
                  └─┘                        ├── Journal_Admin.Personne
                                             └── Documentation.Auteur
Parametres ──► Accueil (le message lit le nom et le contact)
```

Les courriels saisis automatiquement (`Demandeur`, `CreePar`, `Auteur`) restent la trace brute ; une colonne liée
(`Personne`, `Auteur (fiche)`) pointe vers la fiche Utilisateurs correspondante. Les listes inverses
(`Entites.Membres`, `Support.Commentaires`) sont calculées.

## Les principes

- **Traçabilité** : toute table métier a les colonnes `CreeLe`, `CreePar`, `ModifieLe`, `ModifiePar`.
- **Droits par rôle** : le rôle vient de la table Utilisateurs (attribut `user.Profil`) ; une personne non inscrite ou inactive ne voit **que la page d'accueil** (pas même la documentation).
- **Ordre des colonnes** : d'abord ce qui identifie la ligne (nom, titre…), puis le contenu, les liens, l'état, et en dernier la traçabilité.
  L'ordre de la norme est celui du Grist « Gouvernance » ; l'installation le reproduit (les colonnes propres à l'application suivent).
- **Rien n'est supprimé** : mettre une application à la norme ajoute seulement ce qui manque et range les colonnes.

## Les widgets (`widget/`)

Pour chacun : ajouter une page → **Personnalisée** → **URL personnalisée**, niveau d'accès **Accès complet au document**.

| Page | Table liée | Fichier | Rôle |
|---|---|---|---|
| Accueil | Accueil | `accueil.html` | Pour les personnes sans accès : message, étapes et bouton « Demander un accès ». Pour les autres : confirmation et nouveautés |
| Documentation | Documentation | `documentation.html` | Sommaire, recherche, pages Markdown, édition avec aperçu |
| Support | Support | `support.html` | Créer une demande et converser avec le support |
| Administration | (aucune) | `administration.html` | Utilisateurs, droits, support (clore / rouvrir), mise à la norme, paramètres, journal, aide |
| Boîte à outils | Parametres | `boite-a-outils.html` | Outil de Florent Ballu ([TableManager](https://github.com/balludgom/TableManager)) : schéma, gestion des tables et colonnes |

Adresse : `https://raw.githack.com/QuentinLemire/gouvernance-grist/main/widget/<fichier>`
(ou `https://quentinlemire.github.io/gouvernance-grist/widget/<fichier>` une fois GitHub Pages activé).

Le logo DGOM se règle dans **Parametres**, clé `Logo_DGOM` (adresse d'une image publique).

## Créer ou mettre à la norme une application

- **Nouvelle application** : dupliquer le Grist « Modèle DGOM ».
- **Application existante** : poser le widget Administration, onglet **Structure** : « Installer » sur chaque table standard manquante ou incomplète,
  puis « Créer les pages standard » (Accueil, Documentation, Support, Utilisateurs, Boîte à outils) qui range aussi le menu.
- **Par script** : console du navigateur (F12) sur le document, coller `scripts/installer-gouvernance.js` puis
  `await installerGouvernance(['utilisateurs', 'parametres', 'accueil_public', 'support', 'journal', 'documentation'])`.

## Faire évoluer la norme : Grist → Git → toutes les applications

1. **Modifier** les tables standard dans le Grist « Gouvernance » (Parametres : `Source_norme` = `oui`).
2. **Publier** : panneau d'administration → onglet **Structure** → « 📤 Publier la norme ».
   Avec un jeton GitHub (Parametres : `Github_jeton`, droit *Contents : write* sur ce seul dépôt), la publication est directe ;
   sans jeton, les fichiers sont téléchargés et la page d'envoi du dépôt s'ouvre.
   Les clés `…_jeton` ne sont lisibles que par les propriétaires du document (règle posée par l'onglet Droits).
3. **Recevoir** : les widgets des applications pointent sur la branche `main` et se mettent à jour seuls ;
   l'onglet Structure de chaque application signale les tables incomplètes et les installe en un clic (rien n'est supprimé).

Passage futur à GitLab : renseigner `Gitlab_API`, `Gitlab_projet` (et `Gitlab_jeton` dans le document source).
