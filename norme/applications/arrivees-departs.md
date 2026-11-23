# Arrivées-Départs MOM

- **Document** : https://grist.numerique.gouv.fr/o/arrivees-departsmom/7vFZ964YgDgJ/ArriveesdepartsMOM
- **Rôle** : fiches d'arrivée et de départ des agents (DGOM, SMA, CABMOM), circuit RH → bureau → BSSIOM, annuaire.
- **Dernier audit** : 2026-11-23 — **conforme : 16 points sur 16** (`scripts/auditer-norme.js`).

## État par principe (audit automatique du 2026-11-23)

| Principe | État | Détail |
|---|---|---|
| P1 Territoires, Parametres, Accueil, Support, Support_commentaires, Journal_Admin, Documentation | ✅ | Installés ; Documentation remplie (nouveauté, 3 guides, FAQ, procédure administrateur) |
| P1 Entites | ✅ | Colonnes de la norme + colonnes propres : `libelle`, `emetteur`, `utilise`, `etape_bureau` |
| P1 Utilisateurs | ✅ | Colonnes de la norme (`Entite` + `Perimetre`, `Entites_vues`, `Actif`…) + colonnes propres : `qualite`, `est_moi`, `utilise`, `bureaux`, `par_bureau` |
| P2 Traçabilité | ✅ | Les 17 tables métier |
| P3 Nommage | ✅ | Colonnes de la norme conformes ; 175 colonnes métier existantes tolérées |
| P4 Ordre des colonnes | ✅ | Traçabilité en dernier |
| P5 Droits | ✅ | `user.Profil` ; rôles génériques + rôles métier (ci-dessous) ; non-inscrits : Accueil seulement ; 245 règles |
| P6 Registre unique | ✅ | Agents partis dans `Personnel` (colonne `parti`) |
| P7 Widgets | ✅ | Accueil, Documentation, Support, Administration chargés depuis le dépôt (Boîte à outils, hors socle, non installée) ; fiches (4 pages) et pilotage (3 pages) collés dans le document, un code chacun, copie versionnée localement |
| Formules en erreur | ✅ | Aucune |

## Menu
Accueil (Documentation, Support) · Fiche d'arrivée · Fiche de départ · Bannette du bureau · Pilotage (Personnel présent, Personnel parti, Fiches des agents partis, Annuaire) · Administration (Utilisateurs, Référentiel, Données des agents).
⚠️ Ne pas utiliser « Ranger le menu » du widget Administration dans ce document : il remettrait Référentiel et Données des agents (pages métier) sous Pilotage.
Les pages d'administration portent un « Verrou administration » (section sur la table `VueAdmin`, illisible hors administrateurs) : elles n'apparaissent pas aux autres rôles.

## Vérifié « en tant que » (2026-11-23)
- Gestionnaire SMA : menu sans Administration ; Personnel présent = les 3 agents du SMA.
- Chef du bureau BCL : Personnel présent = le seul agent du BCL.

## Plan de mise à la norme

### Phase A — ajouts sans incidence (faite le 2026-11-23)
- Installateur de la norme lancé pour `referentiel_territoires`, `parametres`, `accueil_public` seulement (cette combinaison ne pose aucune règle d'accès).
- Traçabilité ajoutée aux 14 tables métier ; pages Territoires, Paramètres, Accueil rangées sous Administration.

### Phase B — Entites et Utilisateurs (faite le 2026-11-23)
Décision du 2026-11-23 : Entité + Périmètre.
- `email`, `nom`, `role`, `entites_vues` renommées `Email`, `Nom`, `Role`, `Entites_vues` ; `Entites.code` → `Nom` (Grist a mis à jour formules et règles) ;
- `entites` (liste) remplacée par `Entite` (principale) + `Perimetre` (les autres ; le BSSIOM : toutes) — droits calculés identiques pour chaque utilisateur ;
- rôle « Admin » → « Administrateur » ; « Contributeur » ajouté ; attribut `user.Moi` → `user.Profil` (lookup sur `Email_cle`, 161 règles réécrites) ;
- Support, Support_commentaires, Journal_Admin, Documentation installés, avec leurs règles (confidentialité du support, journal réservé, documentation en lecture) ;
- pages standard créées (widgets du dépôt), anciennes pages d'administration retirées du menu.
- **Reste pour plus tard** : la table `Bureaux` reste une table métier (11 colonnes Référence, 24 règles) ; la passer en sous-entités de `Entites` est une étape à part.

### Phase C — nommage (P3)
Renommer les colonnes en `Majuscule_initiale` : Grist met à jour formules et règles, mais le code des widgets est à adapter en même temps.

## Rôles métier propres à l'application
- **Chef de bureau / Adjoint au chef de bureau** : signent les fiches des agents de leurs bureaux.
- **BSSIOM** : coche l'ouverture de chaque application après la signature de l'arrivée, et la fermeture des comptes au départ.
