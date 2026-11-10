# Gouvernance des données Grist — Ministère des Outre-mer (DGOM)

Ce dépôt est la **source de vérité versionnée** des sujets transverses communs aux applications Grist du ministère.
Le référentiel vivant est le document Grist **« Gouvernance »** ; ce dépôt en garde l'historique.

## Contenu

| Dossier | Rôle |
|---|---|
| `widget/admin.html` | Panneau d'administration (utilisateurs, rôles, permissions, support, modèle DGOM, export de structure). Basé sur la « Boîte à outils Grist » de Florent Ballu ([balludgom/TableManager](https://github.com/balludgom/TableManager)), au style de l'État (DSFR). |
| `scripts/installer-gouvernance.js` | Script commenté qui recrée les sujets transverses choisis dans n'importe quel document Grist (à coller dans la console du navigateur). |
| `structure/*.json` | Structure de chaque sujet transverse (tables, colonnes, types, formules), **sans aucune donnée**. |

## Installer le panneau dans un document Grist

1. Ajouter une page → **Personnalisée** → **URL personnalisée**.
2. Coller l'adresse : `https://quentinlemire.github.io/gouvernance-grist/widget/admin.html` (GitHub Pages).
3. Niveau d'accès : **Accès complet au document**.

## Mettre à jour un sujet transverse

1. Modifier le sujet dans le Grist « Gouvernance » (tables *Sujets transverses*, *Structure des tables*, *Structure des colonnes*).
2. Exporter la structure (onglet **📦 Structure & Git** du panneau) et remplacer le fichier dans `structure/`.
3. Noter la version dans la table *Versions Git* du Grist.
4. Dans chaque application, réimporter le `structure.json` : le panneau ajoute seulement ce qui manque, il ne supprime jamais rien.

## Installer les sujets transverses dans une nouvelle application

Deux possibilités, au choix :
- **Depuis le panneau** : onglet **🧩 Modèles** (modèle DGOM en un clic) ou **📦 Structure & Git** (coller un fichier de `structure/`).
- **Par script** : ouvrir le document Grist, console du navigateur (F12), coller `scripts/installer-gouvernance.js` puis
  `await installerGouvernance(['utilisateurs', 'support', 'journal', 'parametres', 'accueil_public'])`.

Dans les deux cas, rien n'est jamais supprimé : seules les tables et colonnes manquantes sont ajoutées.

## Sujets transverses disponibles

| Fichier | Tables | Rôle |
|---|---|---|
| `utilisateurs.json` | Entites, Utilisateurs | Annuaire, rôles, arborescence des services ; base des droits |
| `support.json` | Support | Demandes des utilisateurs et suivi |
| `journal.json` | Journal_Admin | Trace des actions d'administration |
| `parametres.json` | Parametres | Nom de l'application, contact, logo DGOM, version |
| `accueil_public.json` | Accueil | Message affiché aux personnes sans droit (contact modifiable dans Parametres) |
| `catalogue_gouvernance.json` | Applications, Sujets_transverses, Structure_tables, Structure_colonnes, Versions_Git | Propre au Grist « Gouvernance » |
