# Journal des décisions

Une entrée par décision, la plus récente en haut. Format : date, décision, raison, conséquences. Les points encore ouverts sont en bas.

---

### 2026-11-25 — Modèle DGOM reconstruit ; créer une application sans dupliquer Gouvernance
**Fait** : le Grist « 🧩 Modèle DGOM » (même lien) a été vidé puis remonté avec la procédure « document vierge » : page Maintenance,
« Installer » des trois sujets du socle, « Créer les pages du socle », droits standard appliqués (25 règles, garde comprise).
Ses tables avaient les anciens noms et ses pages pointaient vers des fichiers supprimés. Sauvegarde de l'ancien modèle : 10/11/2026.
**Principe** : on ne duplique jamais Gouvernance (source de la norme, avec ses propres données). La norme vient du dépôt
(publiée depuis Gouvernance) ; une application la reçoit soit par copie du Modèle, soit par la page Maintenance sur un document vierge.
**Corrections faites en route** (un document neuf les révélait) : valeurs de départ des Paramètres et de l'Accueil (`donnees/`) ;
pages brutes que Grist crée pour chaque nouvelle table retirées du menu ; opérations qui rechargent la page (règles d'accès,
mise en forme, changement de table d'un widget) faites en un seul envoi ou en dernier ; matrice des droits sans case « héritée ».

### 2026-11-24 — Arrivées-Départs passe aux outils d'administration
**Fait** : page 🧱 Maintenance ajoutée, puis « Mettre les pages à la dernière version » : Administration → santé du document,
Boîte à outils → Explorateur, Rôles et droits, Atelier et Aide créés ; colonne `Acces_Grist` ajoutée (« Réparer »).
Les outils sont posés sur la table-verrou `VueAdmin`, comme la page Administration : invisibles pour la RH et les chefs de bureau
(vérifié en « voir en tant que »). Pages métier et données non touchées. Sauvegarde de référence : 24/11/2026 15 h 29.
**Réglage propre à l'application** : `Roles_administration = BSSIOM` (le BSSIOM administre, pas un « Administrateur »).
**Reste à faire** : traçabilité en fin de table pour Personnel, Arrivee, Depart (Atelier). Le journal (`Gouv_Journal`) est gardé, sans page.

### 2026-11-24 — Le journal quitte le socle : module facultatif
**Décision** : le Journal d'administration (`journal.json`) n'est plus dans le socle. Il s'installe depuis la Maintenance (tables et page 📒 Journal)
pour une application qui a besoin d'un audit des actions d'administration. Retiré de Gouvernance.
**Raison** : dans Gouvernance, ses 28 lignes étaient du bruit technique (mises à jour de pages) ou des informations déjà ailleurs, et mieux :
colonnes `ModifiePar`/`ModifieLe`, *Historique du document › Activité* de Grist, historique Git pour la norme, fil des demandes pour le support.
Aucune ligne « droits appliqués », le seul cas où il aurait apporté quelque chose.
**Conséquences** : les outils n'écrivent au journal que s'il est installé (déjà le cas) ; la carte « journal » de la Maintenance (doublon) est retirée.

### 2026-11-24 — Plus de tableau de bord : Administration = santé du document ; Journal en page classique
**Décision** : le tableau de bord est supprimé. La page 🛡️ Administration affiche la santé du document (la page Santé séparée disparaît) ;
le journal devient une page Grist classique 📒 Journal (le plus récent en haut).
**Raison** : le tableau de bord ne faisait que répéter, en moins complet, ce que montrent les autres pages (Santé, Utilisateurs, Rôles et droits,
Maintenance) ; ses tuiles n'aidaient à aucune décision ; ses 8 dernières actions valaient moins qu'une table du journal filtrable.
**Conséquences** : la santé du document contrôle aussi les personnes (au moins un administrateur actif, un rôle pour chaque personne active,
courriels bien formés et uniques), dans `commun/norme.js` : le script d'audit le fait aussi.

### 2026-11-24 — Utilisateurs : une page Grist classique, pas un widget
**Décision** : la page 👥 Utilisateurs redevient une page Grist classique (annuaire trié par nom et fiche liée). L'outil « Utilisateurs » de la console est supprimé.
**Raison** : il n'apportait rien que Grist ne fasse déjà (filtres, modification, collage en masse, export) et faisait moins bien (courriel non modifiable,
colonnes Périmètre et Entités vues absentes). Règle générale : **pas de widget s'il ne fait pas gagner nettement en simplicité ou en ergonomie**.
**Conséquences** :
- nouvelle colonne calculée `Acces_Grist` (« Éditeur » ou « Lecteur », vide si inactif ou sans rôle) : l'accès à donner dans « Partager » (`utilisateurs.json` 2.1) ;
- mise en forme conditionnelle de `Courriel` : rouge si invalide, orange si en double (posée par la Maintenance en créant la page) ;
- « Mettre les pages à la dernière version » remplace l'ancienne page widget par la page classique.

### 2026-11-24 — Outils d'administration : une page par outil, règles de la norme écrites une fois
**Décision** : l'ancien panneau Administration et la Boîte à outils sont remplacés par des **outils séparés**, une page Grist chacun, sous Administration :
tableau de bord, Utilisateurs, Rôles et droits, Explorateur, Atelier, Santé du document, (Support), Maintenance, Aide.
Ils sont servis par une seule page légère (`console.html?module=…`) qui ne charge que l'outil affiché.
Les règles de conformité sont écrites **une seule fois** (`widget/commun/norme.js`), pour la page Santé et pour le script d'audit, qui en est fabriqué.
**Raison** : des pages légères et sans redondance ; un contrôle de la norme identique partout.
**Conséquences** :
- la Santé du document signale aussi les formules en erreur, les colonnes qui ne servent nulle part et les appels des widgets vers internet ;
  les bibliothèques choisies par la norme (DSFR, marked, DOMPurify, à version figée) y sont distinguées des sorties extérieures ;
- le tableau de bord ne contrôle plus la traçabilité (doublon de P2) : il renvoie vers la Santé ;
- la Maintenance reconnaît encore `administration.html`, `explorateur.html`, `atelier.html` et `boite-a-outils.html` ;
  « Mettre les pages à la dernière version » fait passer un tel document aux outils séparés (outils manquants créés, ancien panneau → tableau de bord,
  Boîte à outils → Explorateur) ;
- `explorateur.html` et `atelier.html` autonomes sont supprimés (doublons des modules de la console) ; `administration.html` et `boite-a-outils.html`
  aussi, une fois Arrivées-Départs basculé (24/11/2026).

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

### 2026-11-24 — Tables de la gouvernance préfixées `Gouv_`
**Décision** : `Gouv_Utilisateurs`, `Gouv_Entites`, `Gouv_Parametres`, `Gouv_Accueil`, `Gouv_Journal` (socle), `Gouv_Support`, `Gouv_Support_commentaires`, `Gouv_Documentation`, `Gouv_Territoires` (modules). Structure en version 2.0.
**Raison** : « Données source » trie les tables par identifiant ; le préfixe les regroupe (l'emoji du titre ne suffisait pas). Appliqué dans Gouvernance et Arrivées-Départs ; Grist a mis à jour formules, règles et attribut `user.Profil` ; widgets de la norme et code des applications adaptés.

### 2026-11-24 — Tables de la norme repérables dans « Données source »
**Décision** : 🧱 devant le nom des tables du socle, 🧩 devant celles des modules installés ; rien sur les tables de l'application. Posé par l'installateur (script et widget Administration).
**Raison** : distinguer d'un coup d'œil ce qui relève de la gouvernance. Le titre garde le nom exact de la table, car Grist recalcule l'identifiant d'après le titre : un libellé libre (« Socle · Entités ») avait renommé les tables en test.

### 2026-11-23 — Majuscule obligatoire et « Courriel »
**Décision** : toute colonne commence par une majuscule, colonnes métier existantes comprises (la tolérance est levée) ; une adresse s'appelle `Courriel` (`Utilisateurs.Email` → `Courriel`, `Email_cle` → `Courriel_cle`). L'audit (P3) le contrôle sans exception, hors colonnes techniques de Grist.
**Conséquence** : Arrivées-Départs renomme ses colonnes métier et adapte le code de ses widgets ; la variable `user.Email` de Grist reste telle quelle.

### 2026-11-23 — Gouvernance ne garde que le socle
**Décision** : les modules hors socle (Support, Documentation, Territoires) sont retirés du document Gouvernance, pages et tables ; leurs fichiers restent sur le dépôt et s'installent dans une application par le bouton « Installer ».
**Conséquence** : ces modules ne se modifient plus depuis Gouvernance (le bouton Publier ne les touche pas) ; les faire évoluer = modifier leur fichier `structure/…json` dans le dépôt.

### 2026-11-23 — Pages de la norme liées à un commit
**Décision** : les widgets standard sont chargés depuis un commit précis du dépôt, pas depuis la branche `main`. Administration → Structure affiche la version des pages et celle du dépôt, et les met à jour d'un clic.
**Raison** : par la branche, raw.githack sert l'ancienne version plusieurs minutes après un commit ; une page liée à un commit est servie immédiatement et ne change plus sans action de l'administrateur (mise à jour maîtrisée).

### 2026-11-23 — Onglet Structure : socle et modules
**Décision** : l'onglet Structure sépare le **socle** (vert « installé », « Réparer » si incomplet) et les **modules facultatifs** (Territoires, Support, Documentation : bouton « Installer » qui pose les tables, les données de référence et la page ; badge gris « installé » sinon).

### 2026-11-23 — Création du dossier `norme/`
**Décision** : les règles écrites, les décisions et les audits vivent dans ce dépôt, à côté de la structure.

---

## Points ouverts


- **Forme des noms de colonnes** : la norme mélange `Nom_complet` (mots séparés par `_`) et `CreeLe` (mots collés). Choisir une forme unique pour les nouvelles colonnes, sans renommer l'existant.
- **Bureaux en sous-entités** : dans les applications qui ont une table de bureaux propre (Arrivées-Départs), la passer en sous-entités de `Entites` — à faire quand une évolution le justifie.

## Documentation modifiable par les seuls propriétaires (2026-11-24)
**Décision** : la table `Gouv_Documentation` est lisible par les personnes inscrites (actives, avec un rôle) et modifiable uniquement par les **propriétaires du document**. Elle sort de la matrice des droits (comme `Gouv_Accueil`) et reçoit deux règles « [Gouvernance] Documentation », posées par l'Administration (garde ou « Appliquer les droits »). La page Documentation n'affiche « Nouvelle page » et « Modifier » qu'aux propriétaires.
**Raison** : la documentation engage l'application ; elle ne doit pas être modifiée par un rôle métier, même administrateur de l'application.

## Plus de carte « Sauvegardes » dans la Maintenance (2026-11-25)
**Décision** : la carte « Sauvegardes » (liste des versions, téléchargement d'une copie .grist) est retirée de la Maintenance.
**Raison** : elle faisait doublon avec Grist : les versions sont dans *Historique du document*, la copie se fait par *Enregistrer une copie* ou *Télécharger*.

## Registre des personnes propre à une application (2026-11-25)
**Décision** : une application existante qui a déjà sa table des personnes la **garde** (OPCOM : `Utilisateurs`, 226 personnes, plusieurs rôles par personne, 240 règles sur `user.Permission`). La norme s'y adapte : le registre est détecté dans les règles d'accès (attribut utilisateur par courriel) ; matrice des droits, garde, santé, simulation et page d'accueil l'utilisent ; plusieurs rôles par personne sont pris en charge (`"r" in user.X.Role`). `Gouv_Utilisateurs`, `Gouv_Entites` et la page 👥 Utilisateurs ne sont alors pas exigées.
**Raison** : migrer 226 personnes et réécrire 240 règles en production pour seulement changer de table ferait courir un risque sans bénéfice ; un seul registre reste un seul registre (P6).

## Plus de paramètre « Pages_retirees » (2026-11-25)
**Décision** : le paramètre `Pages_retirees` est supprimé : toutes les pages du socle (dont ❓ Aide) sont présentes dans chaque application. Seule exception, automatique : l'annuaire 👥 Utilisateurs n'est pas créé quand l'application garde son propre registre des personnes.
**Raison** : une page du socle retirée au cas par cas rend les applications différentes les unes des autres ; l'Aide sert à tous ceux qui administrent.
