# Arrivées-Départs MOM

- **Document** : https://grist.numerique.gouv.fr/o/arrivees-departsmom/7vFZ964YgDgJ/ArriveesdepartsMOM
- **Rôle** : fiches d'arrivée et de départ des agents (DGOM, SMA, CABMOM), circuit RH → bureau → BSSIOM, annuaire.
- **Dernier audit** : 2026-11-23 — **conforme : 17 points sur 17** (`scripts/auditer-norme.js`), nommage strict compris.

## État par principe (audit automatique du 2026-11-23)

| Principe | État | Détail |
|---|---|---|
| P1 Territoires, Parametres, Accueil, Support, Support_commentaires, Journal_Admin, Documentation | ✅ | Installés ; Documentation remplie (nouveauté, 3 guides, FAQ, procédure administrateur) |
| P1 Entites | ✅ | Colonnes de la norme + colonnes propres : `libelle`, `emetteur`, `utilise`, `etape_bureau` |
| P1 Utilisateurs | ✅ | Colonnes de la norme (`Entite` + `Perimetre`, `Entites_vues`, `Actif`…) + colonnes propres : `qualite`, `est_moi`, `utilise`, `bureaux`, `par_bureau` |
| P2 Traçabilité | ✅ | Les 17 tables métier |
| P3 Nommage | ✅ | Toutes les colonnes en majuscule initiale (≈ 190 renommées le 2026-11-23) ; `Courriel`, `Courriel_cle`, `Courriel_pro` |
| P4 Ordre des colonnes | ✅ | Traçabilité en dernier |
| P5 Droits | ✅ | `user.Profil` ; rôles génériques + rôles métier (ci-dessous) ; non-inscrits, inactifs ou sans rôle : Accueil seulement ; 133 règles (245 avant simplification du 2026-11-23) |
| P6 Registre unique | ✅ | Agents partis dans `Personnel` (colonne `parti`) |
| P7 Widgets | ✅ | Accueil, Documentation, Support, Administration chargés depuis le dépôt (Boîte à outils, hors socle, non installée) ; fiches (4 pages) et pilotage (3 pages) collés dans le document, un code chacun, copie versionnée localement |
| Formules en erreur | ✅ | Aucune |

## Menu
Accueil (Documentation, Support) · Fiche d'arrivée · Fiche de départ · Bannette du bureau · Pilotage (Personnel présent, Personnel parti, Fiches des agents partis, Annuaire) · Administration (Utilisateurs, Référentiel, Données des agents).
« Ranger le menu » garde Référentiel et Données des agents sous Administration (pages métier déjà rangées sous Administration : elles y restent depuis le 2026-11-23).
Les pages de la norme sont liées à un commit du dépôt : Administration → Structure → « Mettre les pages à la dernière version ».
Les pages d'administration portent un « Verrou administration » (section sur la table `VueAdmin`, illisible hors administrateurs) : elles n'apparaissent pas aux autres rôles.

## Vérifié « en tant que » (2026-11-23)
- Gestionnaire SMA : menu sans Administration ; Personnel présent = les 3 agents du SMA.
- Chef du bureau BCL : Personnel présent = le seul agent du BCL.
- Personne non inscrite : seulement l'Accueil, avec l'écran « Demander un accès ».
- BSSIOM : les 13 agents présents, menu sans Administration ; coche et décoche les applications ouvertes sur une fiche signée, refusé sur une fiche non signée.

## Simplification des règles d'accès (2026-11-23)
- 245 règles → **133** (53 → 45 ressources), droits vérifiés identiques pour le gestionnaire SMA, le chef du bureau BCL et le BSSIOM.
- Sauvegarde des anciennes règles : `sauvegardes/regles_acl_2026-11-23_avant_simplification.json` (copie locale des widgets).
- Retiré des groupes de colonnes : `+U` administrateur, `-U` hors entité et `-U` final (répétés partout, déjà couverts par les règles de table et par défaut) ; condition d'entité intégrée à chaque `+U` restant.
- Règles de table : « hors entité » et « hors bureau » fusionnés en une seule règle `-RUD` et une seule `-CU`.
- Règles par défaut : « non inscrit », « inactif » et « sans rôle » en une seule règle.
- Défaut corrigé au passage : la règle du BSSIOM sur les applications ouvertes utilisait `rec.agent.arrivee_signee` (suivre une référence), que Grist n'évalue pas : le BSSIOM ne pouvait pas cocher. Remplacée par `rec.verrou` (vrai dès que l'arrivée est signée).

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

### Phase C — nommage (P3) (faite le 2026-11-23)
- ≈ 190 colonnes renommées (`nom` → `Nom`, `email_pro` → `Courriel_pro`, `Email` → `Courriel`…) par `RenameColumn` : Grist a mis à jour formules et règles d'accès.
- **À reprendre à la main** : les formules qui lisent une autre ligne (`$group[0].nom` dans l'annuaire, `p = …; p.statut`) — 20 formules corrigées ; le code des fiches et du pilotage (script `migration/renommer_code.py` de la copie locale, exceptions : classes CSS, identifiants d'éléments, état des filtres, fichiers de l'export Excel).
- Vérifié : aucune formule en erreur, 7 widgets à jour, circuit complet (RH → chef de bureau → BSSIOM → « Installé ») rejoué avec un agent de test, droits par rôle inchangés.
- ⚠️ Les flux n8n qui lisent l'annuaire (`Personnel_summary_Cle`) par l'API doivent utiliser les nouveaux noms (`Nom`, `Prenom`, `Courriel`, `Telephone`…).
- Corrigés au passage : la Bannette ne se chargeait pas (aucune lecture au démarrage) et y affichait des fiches déjà signées (une section non lue effaçait la signature connue de Personnel).

## Données source (2026-11-24)
Inventaire table par table et colonne par colonne (formules, règles d'accès, code des widgets, pages de la norme) : tout sert, sauf le module **Territoires** (table et colonne `Entites.Territoire`, vides et inutilisées), retiré. Le document compte 22 tables ; audit 15/15 (le module retiré n'est plus contrôlé).
Restent à trancher plus tard : `Bureaux.Rattachement` (sous-direction du bureau, inutilisée mais informative) ; `Personnel.Cree_le` / `Cree_par`, doublons de la traçabilité de la norme encore lus par les fiches et une règle d'accès.

## Identifiant de l'agent et doublons (2026-11-24)
- `Personnel.Identifiant` : le RIO (sans espaces, en majuscules), sinon « NOM Prénom ». Repris dans l'annuaire (`Personnel_summary_Cle.Identifiant`, utile pour n8n).
- `Personnel.Doublon_identifiant` : vrai si un autre agent **présent** est la même personne — même RIO quand les deux en ont un, sinon même nom et prénom (accents et majuscules ignorés). Les agents partis ne comptent pas : un agent qui revient a une nouvelle fiche, l'ancienne reste dans l'historique.
- Tant qu'il y a doublon, la fiche affiche une alerte et ne peut être ni transmise au bureau ni signée (règles d'accès ; administrateurs et propriétaires exemptés pour corriger).
- Clé `Cle` supprimée le 2026-11-24 : chaque section pointe directement vers sa ligne de Personnel (colonne `Agent`, référence saisie). La fiche crée l'agent, puis ses sections. `Doublon` (sections) se calcule désormais sur `Agent` et empêche une 2e ligne de section pour le même agent ; `Cle_ok` a disparu.
- Annuaire : vue de Personnel filtrée sur `Present` (colonnes `Telephone`, `Situation`, `Present` calculées dans Personnel) ; l'ancienne table de résumé `Personnel_summary_Cle` est supprimée — **les flux n8n lisent désormais la table `Personnel` (filtre `Present`)**.
- Grade : saisie libre, avec en suggestion les grades déjà renseignés (plus de liste figée dans le code).

## Tables de la gouvernance (2026-11-24)
Renommées `Gouv_…` (🧱 socle, 🧩 modules) ; les tables métier et le référentiel gardent leur nom. ⚠️ Les flux n8n qui lisaient `Utilisateurs` lisent désormais `Gouv_Utilisateurs`.

## Deux tables de fiche : `Arrivee` et `Depart` (2026-11-24)
- Les huit tables de section (`Arrivee_Poste`, `_Telephonie`, `_Informatique`, `_Listes`, `_Signature`, `Depart_Materiel`, `_Comptes`, `_Signature`) sont fusionnées en **`Arrivee`** (56 colonnes) et **`Depart`** (37 colonnes), une ligne par agent reliée par `Agent`. Colonnes rangées dans l'ordre du formulaire papier.
- Deux verrous par table : `Verrou` (contenu de la fiche, figé à la signature) et `Verrou_signature` (case de signature, reste modifiable pour retirer la signature).
- Règles d'accès reprises à l'identique (groupes de colonnes) ; la règle de création interdit toujours de pré-remplir la fiche. La ligne `Depart` n'est créable qu'une fois l'arrivée signée.
- Formules adaptées : `Personnel.Telephone`, `Personnel.Maj_sections`, `Listes.Utilise`, `Boites.Utilise`.
- Testé rôle par rôle (lecture, saisie, signature, création de départ, refus hors entité/bureau) : conforme.
- ⚠️ Flux n8n : lire `Arrivee` / `Depart` au lieu des anciennes tables de section.

## Partage RH / chef de bureau à la DGOM (2026-11-24)
- RH : identité, grade, date du mouvement, date de fin de contrat, statut, bureau, poste et équipements, observations.
- Chef de bureau (ou adjoint) : fonction, pièce, téléphonie, accès internet, réseau local, applications, messagerie, **listes de diffusion et accès aux boîtes partagées** (passés de la RH au chef de bureau), puis signature. SMA et CABMOM (« RH seul ») : la RH remplit tout.
- « Transmettre au bureau » reste grisé tant que la partie RH est incomplète : nom, prénom, grade, date du mouvement, statut (et sa précision si « Autre »), date de fin de contrat pour un contractuel, vacataire, stagiaire ou apprenti, bureau. La fiche affiche ce qui manque.

## Campagne de tests des droits (2026-11-23, données vidées)
Comptes fictifs : admin.test, rh.dgom, rh.sma, chef.bcl, adjoint.bcl, chef.baei, bssiom, lecteur.bcl, contributeur.dgom, inactif, sansrole (+ un inconnu).
Circuit complet rejoué par les comptes eux-mêmes ; 36 contrôles, tous conformes après correction d'une faille (changement d'entité d'une fiche par une RH, corrigé sur 20 règles).
À noter : le rôle **Contributeur** n'a aucun droit d'écriture sur les fiches (il ne fait que lire) ; les gestionnaires lisent toute la liste des utilisateurs.

## Rôles métier propres à l'application
- **Chef de bureau / Adjoint au chef de bureau** : signent les fiches des agents de leurs bureaux.
- **BSSIOM** : coche l'ouverture de chaque application après la signature de l'arrivée, et la fermeture des comptes au départ.
