# Journal des décisions

Une entrée par décision, la plus récente en haut. Format : date, décision, raison, conséquences. Les points encore ouverts sont en bas.

---

### 2026-11-23 — Nouveau socle : Utilisateurs, Accueil, Journal (+ Boîte à outils)
**Décision** : le **socle** comprend Utilisateurs & Entités, la page d'accueil (avec Paramètres, qu'elle lit), le Journal d'administration, et les pages Accueil, Administration, Utilisateurs, Boîte à outils. **Hors socle**, à installer en un clic : Support, Documentation, Territoires.
**Conséquences** :
- la colonne `Entites.Territoire` passe du sujet Utilisateurs au sujet Territoires (`utilisateurs.json` 1.7, `referentiel_territoires.json` 1.3) : une application sans Territoires n'a plus cette colonne ;
- chaque sujet ne publie que ses propres colonnes d'une table partagée ;
- bouton « Installer » pour les pages Documentation et Support (tables comprises).
**Remplace** les deux décisions précédentes du jour sur les pages facultatives.

### 2026-11-23 — Socle et hors socle : Utilisateurs dans le socle, Boîte à outils à installer
**Décision** : les pages du **socle** sont Accueil (› Documentation, Support) et Administration (› **Utilisateurs**). La **Boîte à outils** (outil de développeur) est **hors socle** : elle a son propre bouton « Installer » dans Administration → Structure. **Territoires** reste installée (référencée par `Entites.Territoire`) mais n'a pas besoin de page.
**Raison** : la gestion des utilisateurs fait partie du socle ; ce qui n'en fait pas partie doit pouvoir s'ajouter en un clic, sans être imposé.
**Historique** : une première version rendait aussi Utilisateurs facultative ; annulée le jour même.

### 2026-11-23 — Menu : Documentation et Support sous l'Accueil ; une page de documentation modèle
**Décision** : dans le menu, **Documentation** et **Support** sont des sous-pages de **Accueil** (l'aide et le contact sont rangés avec la page d'entrée). À l'installation du sujet Documentation, une **page modèle « à modifier »** est créée (titre, objet, qui fait quoi, pas à pas, contact) ; le bouton « Nouvelle page » part du même canevas.
**Raison** : un menu plus logique, et une documentation qui ne démarre jamais vide.
**Conséquences** : bouton « Ranger le menu » du widget Administration ; `donnees/documentation.json` chargé par l'installateur si la table est vide.

### 2026-11-23 — Norme assouplie : nommage, rôles métier, widgets métier (P3, P5, P7)
**Décision** :
- **P3** : la convention de nommage s'impose au socle et aux nouvelles colonnes ; les colonnes métier existantes sont tolérées.
- **P5** : les rôles métier sont officiels à côté des rôles génériques, s'ils sont décrits dans la fiche de l'application.
- **P7** : les widgets métier peuvent rester dans le document s'ils n'ont qu'un seul code ; seuls les widgets génériques doivent venir du dépôt.
**Raison** : l'audit d'Arrivées-Départs montrait 181 colonnes sur 248 hors convention : tout renommer aurait réécrit toutes les formules, les 224 règles et les widgets pour un gain faible. Et publier le code métier sur un dépôt public n'est pas souhaitable.
**Conséquences** : le script d'audit classe ces cas en « toléré » ; le point ouvert sur les rôles métier est tranché.

### 2026-11-23 — Mise à la norme d'une application existante : par phases
**Décision** : (A) ajouts sans incidence — tables du socle qui ne dépendent pas des utilisateurs, traçabilité ; (B) Entites / Utilisateurs et droits ; (C) nommage. Chaque phase est vérifiée (formules, widgets) avant la suivante.
**Raison** : sur Arrivées-Départs, l'installateur complet aurait doublé des colonnes et posé des règles par-dessus 224 règles existantes.
**Appliqué** : phases A et B sur Arrivées-Départs (conforme 16/16 le 2026-11-23).

### 2026-11-23 — Plusieurs entités par personne : Entité + Périmètre (P5)
**Décision** : `Utilisateurs.Entite` reste le rattachement principal (une seule entité). On ajoute :
- `Perimetre` (liste d'entités, facultatif) : les autres entités que la personne gère ou consulte ;
- `Entites_vues` (formule) : l'entité principale + le périmètre + **toutes leurs sous-entités** (hiérarchie `Parent`).

Un **bureau est une sous-entité** (DGOM → BRC, BCL…) : pas de table Bureaux à part. Les règles d'accès s'écrivent `rec.Entite in user.Profil.Entites_vues`.
**Raison** : couvre les personnes à cheval sur plusieurs entités ou bureaux (cas d'Arrivées-Départs) sans rien casser dans les applications déjà à la norme (`Entite` est inchangée ; les deux colonnes s'ajoutent).
**Rejeté** : remplacer `Entite` par une liste (changement cassant : `Membres`, règles, widget Administration) ; garder une seule entité (chaque application réinventerait le cas).
**Conséquences** : `structure/utilisateurs.json` passe en version 1.6 ; colonnes ajoutées au Grist Gouvernance. À faire : afficher le périmètre dans le widget Administration.

### 2026-11-23 — Les widgets métier restent hors de la norme
**Décision** : la norme ne couvre que le cas général (tables du socle, principes). Les fiches et le pilotage d'Arrivées-Départs restent propres à l'application.
**Raison** : la gouvernance doit rester applicable à toutes les applications.

### 2026-11-23 — Un seul registre avec un état plutôt que des tables recopiées (P6)
**Décision** : dans Arrivées-Départs, `PersonnelParti` a été fusionnée dans `Personnel` (colonnes `parti`, `parti_le`, `valide_par`).
**Raison** : la recopie imposait deux tables identiques, des règles d'accès en double et des contrôles de cohérence (`archive_ok`, `controle_source`).
**Conséquence** : principe P6, à appliquer aux autres applications.

### 2026-11-23 — `ModifieLe` / `ModifiePar` se recalculent à chaque modification (P2)
**Décision** : `recalcWhen` = 2 pour ces deux colonnes, comme dans `structure/`.
**Raison** : dans le Grist Gouvernance elles étaient repassées en « à la création seulement » sur 5 tables, ce qui vidait la traçabilité de son sens. Corrigé dans le document ; la norme publiée était déjà juste.

### 2026-11-23 — Règles d'accès : une condition par groupe de colonnes
**Décision** : dans un groupe de colonnes, ne garder que les `+U` propres au métier (avec la condition d'entité intégrée) ; l'administrateur, le hors-entité et le refus final sont portés une seule fois par la table et par les règles par défaut.
**Raison** : Arrivées-Départs comptait 245 règles illisibles ; 133 après simplification, droits identiques.

### 2026-11-23 — Support : colonne `Demandeur` dans les commentaires
**Décision** : `Support_commentaires.Demandeur` (formule `$Demande.Demandeur`) ; la règle de confidentialité porte sur `rec.Demandeur`.
**Raison** : une règle d'accès ne lit pas une colonne à travers une référence (`rec.Demande.Demandeur`). Appliqué dans Gouvernance et Arrivées-Départs ; `structure/support.json` 1.7.

### 2026-11-23 — Publication : garde-fou contre une page périmée
**Décision** : le widget Administration porte `VERSION_WIDGET` (à changer à chaque modification) ; « Publier la norme » refuse si la version du dépôt est différente. Une table d'un sujet qui dépend d'un autre sujet définissant la même table est traitée comme « extension », même sans la marque.
**Raison** : le 2026-11-23, une publication faite avec une copie en cache (raw.githack) a remis `Entites.Territoire` dans Utilisateurs et retiré la marque `extension` de Territoires. Fichiers remis en état (Utilisateurs 1.9, Territoires 1.5).

### 2026-11-23 — Création du dossier `norme/`
**Décision** : les règles écrites, les décisions et les audits vivent dans ce dépôt, à côté de la structure.

---

## Points ouverts


- **Forme des noms de colonnes** : la norme mélange `Nom_complet` (mots séparés par `_`) et `CreeLe` (mots collés). Choisir une forme unique pour les nouvelles colonnes, sans renommer l'existant.
- **Bureaux en sous-entités** : dans les applications qui ont une table de bureaux propre (Arrivées-Départs), la passer en sous-entités de `Entites` — à faire quand une évolution le justifie.
