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
| `journal.json` | Gouv_Journal *(hors socle)* | Trace des actions des outils d'administration, pour une application qui a besoin d'un audit |
| `documentation.json` | Documentation *(hors socle)* | Guides, procédures, FAQ, notes et nouveautés en Markdown |

Chaque fichier ne contient que la structure (tables, colonnes, types, formules), jamais de données.

**Socle** : `utilisateurs`, `parametres`, `accueil_public`. **Hors socle** (bouton « Installer » dans la Maintenance) : `support`, `documentation`, `journal`, `referentiel_territoires`.

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
| Organigramme (module « Bureaux de la DGOM ») | Gouv_Entites | `organigramme.html` | Organigramme dessiné à partir des Entités et des Utilisateurs (chef, adjoint, membres) : rien à tracer à la main |
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
| 🧱 Maintenance | `maintenance` | Sujets de la norme, pages standard, version des pages, paramètres, publication de la norme |
| ❓ Aide | `aide` | Mode d'emploi |

La page **👥 Utilisateurs** (annuaire et fiche) et, si le journal est installé, **📒 Journal** (le plus récent en haut) ne sont pas des outils
mais des pages Grist classiques : filtres, collage et export de Grist suffisent. Les courriels mal formés (rouge) ou en double (orange) ressortent par une mise en forme ; la colonne **Accès Grist** dit
quel accès donner à chacun dans « Partager ».

Idée de la Boîte à outils et première version : Florent Ballu ([TableManager](https://github.com/balludgom/TableManager)).
Fichiers communs à toutes les pages : `widget/commun/` (style DSFR, outils, lecture de la structure, règles de la norme).

Adresse (GitHub Pages) : `https://quentinlemire.github.io/gouvernance-grist/widget/<fichier>?v=<commit>`.
Pour la première pose, l'adresse sans `?v=` convient ; ensuite, **Maintenance** →
« 🔄 Mettre les pages à la dernière version » fait pointer toutes les pages sur le dernier commit.
Les anciennes adresses raw.githack (service tombé en panne le 2026-11-24) sont reconnues et remplacées par ce bouton.

Le logo DGOM se règle dans **Parametres**, clé `Logo_DGOM` (adresse d'une image publique).
Les **administrateurs** de l'application : jusqu'à 3 personnes choisies dans Maintenance › Paramètres (3 menus déroulants,
clé `Administrateurs`). Ils ont tous les droits sur les données et le support ; les pages d'administration restent aux propriétaires du document.

## Créer ou mettre à la norme une application

**Nouvelle application, le plus simple** : ouvrir le Grist **« 🧩 Modèle DGOM »** (document de type *Modèle* : il s'ouvre en bac à sable),
puis **« Enregistrer une copie »** dans l'espace voulu. La copie contient déjà le socle, les pages et les règles d'accès de base. Ensuite :
1. 🧱 **Maintenance › Paramètres** : nom de l'application, contact, logo ;
2. 👥 **Utilisateurs** : s'inscrire avec le rôle Administrateur (et les autres personnes) ;
3. 🔐 **Rôles et droits** : « Proposition standard », ajuster, « Appliquer ces droits » ; puis partager le document dans Grist (colonne *Accès Grist*) ;
4. 🏗️ **Atelier** : créer les tables métier (noms, types, traçabilité selon la norme) ;
5. 🛡️ **Administration** : la santé du document doit être au vert.

**À partir d'un document vierge** (ou d'une application existante) :
1. ajouter une page → **Personnalisée** → **URL personnalisée** :
   `https://quentinlemire.github.io/gouvernance-grist/widget/console.html?module=maintenance`, accès **« Accès complet au document »** ;
2. dans cette page Maintenance : **« Installer tout le socle et ranger le menu »** : les tables du socle (Utilisateurs & entités,
   Paramètres, Page d'accueil publique) puis les pages sont créées, le menu est rangé, et la page Maintenance se rattache d'elle-même à
   la table des outils (la table « Table1 » créée avec la page peut ensuite être supprimée). Chaque page manquante a aussi son
   bouton « Installer » (sa table, puis la page) ;
3. **« Mettre les pages à la dernière version »**, puis les étapes 1 à 5 ci-dessus. Les modules facultatifs (Support, Documentation, Journal,
   Territoires) s'installent depuis la même page.

**Pour cacher les outils à certains rôles** (comme dans Arrivées-Départs) : poser le widget de la page Administration sur une table-verrou
lisible des seuls administrateurs ; les outils créés ensuite s'y rattachent et en héritent.

## Synchroniser l'annuaire (n8n)

Le dossier [`synchro/`](synchro/README.md) contient un workflow n8n qui remplit chaque matin la table Gouv_Utilisateurs des
applications à partir de l'annuaire d'Arrivées-Départs : nouveaux agents ajoutés sans rôle, noms et entités tenus à jour,
agents partis désactivés. Le rôle reste toujours géré dans l'application.

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
