# Gouvernance des données Grist — Ministère des Outre-mer (DGOM)

Ce dépôt est la **source de vérité versionnée** des sujets transverses communs aux applications Grist du ministère.
Le référentiel vivant est le document Grist **« Gouvernance »** ; ce dépôt en garde l'historique.

## Contenu

| Dossier | Rôle |
|---|---|
| `widget/admin.html` | Panneau d'administration (utilisateurs, rôles, permissions, support, modèle DGOM, export de structure). Basé sur la « Boîte à outils Grist » de Florent Ballu ([balludgom/TableManager](https://github.com/balludgom/TableManager)), au style de l'État (DSFR). |
| `structure/*.json` | Structure de chaque sujet transverse (tables, colonnes, types, formules), **sans aucune donnée**. |

## Installer le panneau dans un document Grist

1. Ajouter une page → **Personnalisée** → **URL personnalisée**.
2. Coller l'adresse : `https://cdn.jsdelivr.net/gh/QuentinLemire/gouvernance-grist@main/widget/admin.html`
   (ou l'adresse GitHub Pages si elle est activée : `https://quentinlemire.github.io/gouvernance-grist/widget/admin.html`).
3. Niveau d'accès : **Accès complet au document**.

## Mettre à jour un sujet transverse

1. Modifier le sujet dans le Grist « Gouvernance » (tables *Sujets transverses*, *Structure des tables*, *Structure des colonnes*).
2. Exporter la structure (onglet **📦 Structure & Git** du panneau) et remplacer le fichier dans `structure/`.
3. Noter la version dans la table *Versions Git* du Grist.
4. Dans chaque application, réimporter le `structure.json` : le panneau ajoute seulement ce qui manque, il ne supprime jamais rien.
