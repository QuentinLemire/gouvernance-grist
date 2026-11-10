# Gouvernance des données Grist — Ministère des Outre-mer (DGOM)

Ce dépôt est la **norme DGOM versionnée** des applications Grist : les sujets transverses que toute application doit contenir, et le modèle qui les applique.
Le référentiel vivant est le document Grist **« Gouvernance »** ; ce dépôt en garde l'historique.

## Contenu

| Dossier | Rôle |
|---|---|
| `widget/administration.html` | **Panneau d'administration** : tableau de bord et contrôles de santé, utilisateurs (rôles, périmètre territorial, ajout en masse, export), droits rôle × table, support avec fil de commentaires, installation des sujets transverses, paramètres et journal. |
| `widget/accueil.html` | **Page d'accueil** : message « accès réservé » et bouton de contact pour les personnes non inscrites ; mot d'accueil, nouveautés et documentation pour les autres. |
| `widget/support.html` | **Support** côté utilisateur : créer une demande, suivre ses demandes et converser avec le support. La clôture et la réouverture se font dans le panneau d'administration. |
| `widget/documentation.html` | **Documentation** : sommaire par rubrique, recherche, pages Markdown mises en forme, édition avec aperçu en direct. |
| `widget/boite-a-outils.html` | **Boîte à outils** de Florent Ballu ([balludgom/TableManager](https://github.com/balludgom/TableManager)) : explorateur de schéma et des widgets, gestionnaire des tables et colonnes (création en masse, traçabilité, historique). |
| `widget/commun/` | Styles DSFR (Marianne, bleu France, bloc-marque) et outils partagés par les widgets. |
| `scripts/installer-gouvernance.js` | Script commenté qui recrée les sujets transverses choisis dans n'importe quel document Grist (à coller dans la console du navigateur). |
| `structure/*.json` | Structure de chaque sujet transverse (tables, colonnes, types, formules), **sans aucune donnée**. |
| `donnees/*.json` | Données de référence publiques livrées avec un sujet (13 territoires, programmes P123 / P138). |

## Installer les widgets dans un document Grist

Pour chaque widget : ajouter une page ou un widget → **Personnalisée** → **URL personnalisée**, niveau d'accès **Accès complet au document**.

| Page | Table liée | Adresse |
|---|---|---|
| Accueil | Accueil | `https://quentinlemire.github.io/gouvernance-grist/widget/accueil.html` |
| Documentation | Documentation | `https://quentinlemire.github.io/gouvernance-grist/widget/documentation.html` |
| Support | Support | `https://quentinlemire.github.io/gouvernance-grist/widget/support.html` |
| Boîte à outils | Parametres | `https://quentinlemire.github.io/gouvernance-grist/widget/boite-a-outils.html` |
| Administration | (aucune) | `https://quentinlemire.github.io/gouvernance-grist/widget/administration.html` |

Tant que GitHub Pages n'est pas activé (Settings → Pages → branche `main`, dossier racine), remplacer le début de l'adresse par
`https://raw.githack.com/QuentinLemire/gouvernance-grist/main/`.

Les widgets ne contournent jamais les règles d'accès Grist : une personne non inscrite ne lit que la page Accueil et la documentation marquée « Visible par tous ». Pour le support, cocher « Support : chacun ne voit que ses demandes » dans l'onglet Droits du panneau : chaque personne ne voit que ses demandes et seuls les Administrateurs changent le statut.

## Le logo DGOM

Renseigner son adresse (image PNG ou SVG publique) dans la table **Parametres**, clé `Logo_DGOM`. Sans logo, l'en-tête affiche « DGOM » en texte.

## Mettre à jour un sujet transverse

1. Modifier le sujet dans le Grist « Gouvernance » (tables *Sujets transverses*, *Structure des tables*, *Structure des colonnes*).
2. Exporter la structure (onglet **Structure** du panneau) et remplacer le fichier dans `structure/`.
3. Noter la version dans la table *Versions Git* du Grist.
4. Dans chaque application, réimporter le `structure.json` : le panneau ajoute seulement ce qui manque, il ne supprime jamais rien.

## Installer les sujets transverses dans une nouvelle application

Deux possibilités, au choix :
- **Depuis le panneau** : onglet **Structure**, qui compare le document au dépôt et installe en un clic les sujets manquants (avec leurs dépendances et les données de référence).
- **Par script** : ouvrir le document Grist, console du navigateur (F12), coller `scripts/installer-gouvernance.js` puis
  `await installerGouvernance(['utilisateurs', 'parametres', 'accueil_public', 'support', 'journal', 'documentation', 'nouveautes'])`.

Dans les deux cas, rien n'est jamais supprimé : seules les tables et colonnes manquantes sont ajoutées.

## Sujets transverses disponibles

| Fichier | Tables | Rôle |
|---|---|---|
| `utilisateurs.json` | Entites, Utilisateurs | Annuaire, rôles (Administrateur, AdminTerritoire, AdminRPROG, Gestionnaire, Contributeur, Lecteur), périmètre territorial ; base des droits |
| `referentiel_territoires.json` | Territoires | Les 13 territoires ultramarins (codes COG) |
| `referentiel_programmes.json` | Programmes | Programmes budgétaires (P123, P138) |
| `parametres.json` | Parametres | Nom de l'application, contact, logo DGOM, version |
| `accueil_public.json` | Accueil | Message affiché aux personnes sans droit (contact modifiable dans Parametres) |
| `support.json` | Support, Support_commentaires | Demandes des utilisateurs et conversation avec le support (v1.2 : messages et événements de clôture / réouverture) |
| `journal.json` | Journal_Admin | Trace des actions d'administration |
| `documentation.json` | Documentation | Guides, procédures, FAQ et notes en Markdown |
| `nouveautes.json` | Nouveautes | Journal des versions affiché sur l'accueil |
| `catalogue_gouvernance.json` | Sujets_transverses, Structure_tables, Structure_colonnes, Versions_Git, Demandes_evolution | La norme elle-même et son circuit de changement ; propre au Grist « Gouvernance » |
