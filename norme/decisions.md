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

## Règles d'accès orphelines retirées automatiquement (2026-11-25)
**Constat** : dans OPCOM, « Ne leur montrer que l'accueil » échouait avec « Invalid tables in rules ». Deux règles visaient des tables qui n'existent plus (`Tests`, et une table de synthèse regroupée autrement). Grist refuse alors **tout** changement de règles d'accès, quel qu'il soit.
**Décision** : avant chaque enregistrement de règles, la norme retire les règles dont la table n'existe plus, et le note au journal. Le panneau 🔐 Rôles et droits les signale à l'avance.
**Raison** : ces règles ne protègent plus rien, et elles bloquent toute la gestion des droits.

## Module facultatif « Bureaux de la DGOM » et organigramme (2026-11-26)
**Décision** : pas de table à part. Le module complète le socle : il ajoute aux Entités `Id_DGOM` (identifiant de l'Outil cabDG, pour relier les documents entre eux), `Courriel` (secrétariat), `Couleur` et « Dans l'organigramme », et aux Utilisateurs `Fonction` (chef, adjoint…). Il remplit les Entités avec les directions, sous-directions et bureaux de la DGOM : une entité déjà présente (même nom) est seulement complétée, jamais écrasée. La page 🏢 Organigramme se dessine à partir des Entités et des Utilisateurs, avec le rendu de l'organigramme de l'Outil cabDG (vues entités seules / responsables / détaillée, recherche, replier).
Les lignes techniques de la source (« Tous », « · », « Direction ») et les structures hors DGOM (MOM, Cabinet, BDC, DEPAFI) ne sont pas reprises.
**Raison** : les entités servent déjà aux droits (qui voit quoi) et rattachent les personnes ; une seule table évite deux listes de bureaux à tenir à jour, et l'organigramme montre les vraies personnes. Première version avec une table `Gouv_Bureaux` séparée abandonnée le jour même, à la demande de Quentin.

## Champs de page orphelins retirés automatiquement (2026-11-26)
**Constat** : Gouvernance affichait « Unexpected error » (lastIndexOf / startsWith) à chaque chargement. 19 champs des pages d'outils (Administration, Rôles et droits, Maintenance, Aide) désignaient les colonnes de `Gouv_Journal`. Les outils avaient été rattachés à cette table, puis remis sur `Gouv_Parametres` quand le journal est sorti du socle ; leurs champs avaient été gardés, et ils ne pointaient plus sur rien une fois la table supprimée. Même cas dans la copie DEV d'OPCOM (3 champs).
**Décision** : quand la Maintenance change la table d'une section, elle retire d'abord ses champs (un widget en accès complet n'en a pas besoin). « Installer / Ranger le menu » et « Mettre les pages à la dernière version » retirent aussi tout champ qui désigne une colonne disparue, et le notent au journal.
**Raison** : un champ orphelin ne sert à rien et fait planter l'affichage de Grist ; on le corrige à la source et on répare l'existant sans rien demander.

## Organigramme rangé sous 👥 Utilisateurs, dans Administration (2026-11-26)
**Décision** : la page 🏢 Organigramme est placée en retrait sous 👥 Utilisateurs (et non plus sous l'Accueil) et s'ouvre sur la vue détaillée.
**Raison** : elle sert d'abord à voir, d'un coup d'œil, quelles personnes sont dans quel bureau ; c'est le complément de l'annuaire.

## Organigramme : chef et adjoint bien distingués (2026-11-26)
**Décision** : dans chaque case, le chef vient en tête avec une étiquette pleine (couleur du bureau), l'adjoint ensuite avec une étiquette en contour, puis un filet avant les autres membres. `Utilisateurs.Fonction` devient une liste de choix (Directeur, Sous-directeur, Chef de bureau, Adjoint au chef de bureau, Chef de mission…, et leurs adjoints).
**Raison** : en gras et demi-gras, chef et adjoint se confondaient ; une liste de choix évite les fautes de frappe qui empêcheraient de reconnaître le chef ou l'adjoint.

## Encadrement plutôt que Fonction (2026-11-26)
**Décision** : la colonne ajoutée aux Utilisateurs par le module Organigramme s'appelle `Encadrement` (Directeur, Sous-directeur, Chef de bureau, Adjoint au chef de bureau, Chef de mission, et leurs adjoints ; vide = agent). Dans Arrivées-Départs, la fiche d'arrivée a la même case (`Personnel.Encadrement`), remplie par le bureau à côté de la Fonction.
**Raison** : dans Arrivées-Départs, `Fonction` est déjà l'intitulé du poste en texte libre ; mélanger le poste et le niveau d'encadrement aurait rendu les deux illisibles. Mêmes libellés que les rôles d'Arrivées-Départs (« Chef de bureau », « Adjoint au chef de bureau »), pour que l'annuaire tiré des arrivées alimente l'organigramme sans conversion.

## Identifiant DGOM : des numéros qui se suivent (2026-11-26)
**Décision** : `Gouv_Entites.Id_DGOM` est calculé : 1, 2, 3… sans trou, dans l'ordre de l'organigramme (la direction, puis chaque entité suivie de ses sous-entités, par ordre alphabétique). Ajouter ou supprimer une entité renumérote les suivantes. La table est triée par cet identifiant dans « Données source ». Les données de départ désignent le parent par son nom, et non plus par l'identifiant de l'Outil cabDG.
**Raison** : demande de Quentin : une liste rangée et numérotée sans trou se lit d'un coup d'œil. Pour relier une entité depuis un autre document, utiliser son nom ; le numéro, lui, peut bouger.

## Plus de colonne Encadrement : c'est la Fonction (2026-11-26)
**Décision** : la colonne `Encadrement` est retirée (Utilisateurs dans la norme, Personnel dans Arrivées-Départs). L'organigramme lit `Fonction` : « Chef de bureau », « Sous-directeur »… en tête, « Adjoint au chef de bureau »… juste dessous. Dans la fiche d'arrivée, le champ FONCTION propose ces fonctions (on peut en taper une autre).
**Raison** : remarque de Quentin : « chef de bureau » est une fonction ; deux cases pour la même information se contredisent un jour ou l'autre.

## Annuaire d'Arrivées-Départs regroupé par courriel (2026-11-26)
**Décision** : la table de l'annuaire est regroupée directement par `Personnel.Courriel` (`Personnel_summary_Courriel`) ; une colonne `Present` ne garde que les agents présents (filtre de la page et règles d'accès). Plus de colonne technique « Annuaire ».
**Raison** : la clé de regroupement d'une table de synthèse prend le nom de la colonne source et ne se renomme pas ; regrouper par le courriel lui-même évite une colonne en double.

## Plus de colonne Périmètre dans Utilisateurs (2026-11-26)
**Décision** : `Gouv_Utilisateurs.Perimetre` est retirée de la norme (remplace la décision du 2026-11-23 « Entité + Périmètre »). `Entites_vues` = l'entité de la personne et toutes ses sous-entités. Quand quelqu'un doit voir d'autres entités, on le donne directement dans les règles d'accès (🔐 Rôles et droits).
**Raison** : demande de Quentin : une colonne de plus à remplir pour un cas rare, alors que les droits se règlent déjà dans le panneau des droits. Arrivées-Départs l'utilise encore (compte BSSIOM : DGOM + SMA + CABMOM) : à basculer sur une règle d'accès avant de la retirer.

## Administration visible des seuls propriétaires (2026-11-26)
**Décision** : nouveau sujet du socle `administration` : la table `Gouv_Administration` (vide, sert de verrou), lisible par les seuls propriétaires du document. Les pages d'administration (🛡️ Administration, Rôles et droits, Explorateur, Atelier, Maintenance, Aide) y sont rattachées : Grist cache une page à qui ne peut pas lire sa table. Deux règles [Gouvernance] aux conditions opposées (`user.Access == OWNER` lit, `user.Access != OWNER` rien) : leur ordre ne compte pas. Posées par « Installer tout le socle et ranger le menu » et par « Appliquer ces droits ».
**Raison** : demande de Quentin : l'administration ne regarde que les propriétaires. Remplace l'ancien rattachement à Gouv_Parametres (lisible par tous : la page d'accueil en a besoin) ou à une table-verrou propre à l'application (VueAdmin dans Arrivées-Départs, lisible par le rôle BSSIOM).
**À savoir** : 👥 Utilisateurs et 🏢 Organigramme, rangées sous Administration, restent visibles de ceux qui ont le droit de lire leur table (matrice des droits).

## Plus de boutons de renvoi dans l'administration (2026-11-26)
**Décision** : les boutons « Corriger → » de la santé du document, « Ouvrir l'Atelier → », « Installer → » et les « Ouvrir … → » de l'Aide sont retirés ; la carte Traçabilité de la Maintenance (un simple renvoi vers l'Atelier) aussi. Les outils montrent ce qui cloche ; on ouvre soi-même l'outil voulu dans le menu.
**Raison** : demande de Quentin : ces boutons ne corrigeaient rien, ils changeaient seulement de page ; l'important est de voir clairement le problème.

## Administrateurs : 3 personnes choisies, plus de Roles_administration (2026-11-26)
**Décision** : le paramètre `Roles_administration` (un ou plusieurs rôles) est remplacé par `Administrateurs` : jusqu'à 3 personnes, choisies dans 3 menus déroulants de Maintenance › Paramètres parmi les personnes actives du registre. Ils ont tous les droits sur les tables gérées par la matrice (règle `user.Email in [...]`, posée par « Appliquer ces droits », après la règle qui cache les jetons) et gèrent toutes les demandes de support. Les pages d'administration restent réservées aux propriétaires du document. La santé du document vérifie qu'au moins un administrateur choisi est actif.
**Raison** : demande de Quentin : désigner nommément qui administre, plutôt qu'un rôle que n'importe qui peut recevoir.
