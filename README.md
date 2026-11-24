# Norme DGOM des applications Grist — Ministère des Outre-mer

Ce dépôt décrit **les tables et les principes communs** à toutes les applications Grist de la DGOM, et les widgets qui vont avec.
Le Grist **« Gouvernance »** en est la base source ; le Grist **« Modèle DGOM »** est le point de départ de toute nouvelle application.

Les règles écrites, le journal des décisions, la checklist d'audit et l'état de chaque application sont dans le dossier [`norme/`](norme/README.md).

## Les tables standard (`structure/`)

| Fichier | Tables | Rôle |
|---|---|---|
| `utilisateurs.json` | Entites, Utilisateurs | Annuaire et rôles génériques (Administrateur, Gestionnaire, Contributeur, Lecteur) ; base des droits |
| `referentiel_territoires.json` | Territoires *(hors socle)* | Les 13 territoires ultramarins (codes COG, données dans `donnees/`) ; ajoute la colonne `Entites.Territoire` |
| `parametres.json` | Parametres | Nom de l'application, contact, logo DGOM |
| `accueil_public.json` | Accueil | Message affiché aux personnes sans droit |
| `support.json` | Support, Support_commentaires *(hors socle)* | Demandes et conversation avec le support |
| `journal.json` | Journal_Admin | Trace des actions d'administration |
| `documentation.json` | Documentation *(hors socle)* | Guides, procédures, FAQ, notes et nouveautés en Markdown |

Chaque fichier ne contient que la structure (tables, colonnes, types, formules), jamais de données.

**Socle** : `utilisateurs`, `parametres`, `accueil_public`, `journal`. **Hors socle** (bouton « Installer » dans Administration → Structure) : `support`, `documentation`, `referentiel_territoires`.

### Comment les tables sont liées

```
Territoires ◄── Entites ◄── Utilisateurs ◄──┬── Support ◄── Support_commentaires
                  ▲ │ (Parent)              ├── Support_commentaires.Auteur
                  └─┘                       ├── Journal_Admin.Personne
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
| Administration et ses outils | Parametres | `console.html?module=<outil>` | Une page par outil (voir ci-dessous) |

**Outils d'administration** : une seule page `console.html`, qui n'affiche que l'outil demandé (`?module=…`) et ne charge que son code
(`widget/admin/`). Sans `module`, elle affiche tous les outils avec un menu.

| Page | `module` | Rôle |
|---|---|---|
| 🛡️ Administration | `sante` | Santé du document : conformité à la norme (P1 à P7), personnes (administrateurs, rôles, courriels), formules en erreur, colonnes inutilisées, sorties internet |
| 🔐 Rôles et droits | `droits` | Qui peut faire quoi, table par table ; aperçu des règles ; « Voir en tant que » (simulation et lien vers le vrai mode Grist) |
| 🔍 Explorateur | `explorateur` | Schéma des tables (MLD), pages ↔ données, widgets (tables lues, sorties internet) |
| 🏗️ Atelier | `atelier` | Créer et modifier tables et colonnes selon la norme |
| 🆘 Support | `support` | Traiter les demandes (si le module Support est installé) |
| 🧱 Maintenance | `maintenance` | Sujets de la norme, pages standard, version des pages, sauvegardes et copie du document, paramètres, publication de la norme |
| ❓ Aide | `aide` | Mode d'emploi |

Les pages **👥 Utilisateurs** (annuaire et fiche) et **📒 Journal** (le plus récent en haut) ne sont pas des outils mais des pages
Grist classiques : filtres, collage et export de Grist suffisent. Les courriels mal formés (rouge) ou en double (orange) ressortent par une mise en forme ; la colonne **Accès Grist** dit
quel accès donner à chacun dans « Partager ».

Idée de la Boîte à outils et première version : Florent Ballu ([TableManager](https://github.com/balludgom/TableManager)).
Fichiers communs à toutes les pages : `widget/commun/` (style DSFR, outils, lecture de la structure, règles de la norme).

Adresse (GitHub Pages) : `https://quentinlemire.github.io/gouvernance-grist/widget/<fichier>?v=<commit>`.
Pour la première pose, l'adresse sans `?v=` convient ; ensuite, **Maintenance** →
« 🔄 Mettre les pages à la dernière version » fait pointer toutes les pages sur le dernier commit.
Les anciennes adresses raw.githack (service tombé en panne le 2026-11-24) sont reconnues et remplacées par ce bouton.

Le logo DGOM se règle dans **Parametres**, clé `Logo_DGOM` (adresse d'une image publique).

## Créer ou mettre à la norme une application

- **Nouvelle application** : ouvrir le Grist « Modèle DGOM » (document de type *Modèle* : il s'ouvre en bac à sable) puis « Enregistrer une copie ».
- **Application existante** : poser la page Maintenance (`console.html?module=maintenance`) : « Installer » sur chaque table standard manquante
  ou incomplète, puis « Créer les pages standard » (Accueil, Administration et ses outils) qui range aussi le menu.
- **Par script** : console du navigateur (F12) sur le document, coller `scripts/installer-gouvernance.js` puis
  `await installerGouvernance(['utilisateurs', 'parametres', 'accueil_public', 'support', 'journal', 'documentation'])`.

## Auditer une application

- **Avec les outils d'administration** : page 🛡️ **Administration** (santé du document), puis « Copier le rapport ».
- **Sans eux** : console du navigateur (F12) sur le document, coller `scripts/auditer-norme.js` puis `const audit = await auditerNorme()`.

Les deux ne modifient rien et appliquent **les mêmes règles**, écrites une seule fois dans `widget/commun/norme.js` : socle, traçabilité,
nommage, ordre, droits, registre unique, widgets, formules en erreur, colonnes inutilisées. Le rapport (`audit.markdown`) est le tableau
à coller dans `norme/applications/<application>.md`.
`scripts/auditer-norme.js` est **fabriqué** à partir de `norme.js` : après toute modification des règles, lancer `node scripts/generer-audit.js`.

## Faire évoluer la norme : Grist → Git → toutes les applications

1. **Modifier** les tables standard dans le Grist « Gouvernance » (Parametres : `Source_norme` = `oui`).
2. **Publier** : panneau d'administration → onglet **Structure** → « 📤 Publier la norme ».
   Avec un jeton GitHub (Parametres : `Github_jeton`, droit *Contents : write* sur ce seul dépôt), la publication est directe ;
   sans jeton, les fichiers sont téléchargés et la page d'envoi du dépôt s'ouvre.
   Les clés `…_jeton` ne sont lisibles que par les propriétaires du document (règle posée par l'onglet Droits).
3. **Recevoir** : les widgets des applications pointent sur la branche `main` et se mettent à jour seuls ;
   l'onglet Structure de chaque application signale les tables incomplètes et les installe en un clic (rien n'est supprimé).

Passage futur à GitLab : renseigner `Gitlab_API`, `Gitlab_projet` (et `Gitlab_jeton` dans le document source).
