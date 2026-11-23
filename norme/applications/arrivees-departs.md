# Arrivées-Départs MOM

- **Document** : https://grist.numerique.gouv.fr/o/arrivees-departsmom/7vFZ964YgDgJ/ArriveesdepartsMOM
- **Rôle** : fiches d'arrivée et de départ des agents (DGOM, SMA, CABMOM), circuit RH → bureau → BSSIOM, annuaire.
- **Dernier audit** : 2026-11-23 — **en cours de mise à la norme** (phase A faite, phase B à faire).

## État par principe

| Principe | État | Détail |
|---|---|---|
| P1 Territoires | ✅ | Installée le 2026-11-23 (13 territoires) |
| P1 Parametres | ✅ | Installée et remplie (nom de l'application, direction, contact, logo) |
| P1 Accueil | ✅ | Installée (message pour les personnes sans droit) ; le widget Accueil n'est pas encore posé |
| P1 Entites | ⚠️ | Modèle propre (`code`, `libelle`, `emetteur`, `utilise`, `etape_bureau`) ; colonnes de la norme absentes — phase B |
| P1 Utilisateurs | ⚠️ | Modèle propre (`email`, `nom`, `role`, `entites` multiples, `bureaux`, `qualite`…) ; colonnes de la norme absentes — phase B |
| P1 Support, Support_commentaires, Journal_Admin | ❌ | Dépendent des Utilisateurs de la norme — phase B |
| P1 Documentation | ❌ | Facultative — phase B |
| P2 Traçabilité | ✅ | `CreeLe`, `CreePar`, `ModifieLe`, `ModifiePar` sur les 14 tables métier (2026-11-23). Création reprise de `cree_le` / `cree_par` pour Personnel ; vide pour les lignes plus anciennes des autres tables (aucune trace à reprendre) |
| P3 Nommage | ❌ | Colonnes en minuscules (`nom_complet`) — phase C |
| P5 Droits | ⚠️ | Attribut `user.Moi` (et non `user.Profil`) ; rôles : Admin, Gestionnaire, Lecteur (génériques) + Chef de bureau, Adjoint au chef de bureau, BSSIOM (métier) ; 224 règles d'accès — phase B |
| P6 Registre unique | ✅ | `PersonnelParti` fusionnée dans `Personnel` le 2026-11-23 |
| P7 Widgets | ⚠️ | Code de fiche commun à 4 pages (variantes par `data-type`) ✅ ; mais collé dans le document (7 exemplaires), pas chargé par URL |
| Formules en erreur | ✅ | Aucune |

## Plan de mise à la norme

### Phase A — ajouts sans incidence (faite le 2026-11-23)
- Installateur de la norme lancé pour `referentiel_territoires`, `parametres`, `accueil_public` seulement (cette combinaison ne pose aucune règle d'accès).
- Traçabilité ajoutée aux 14 tables métier ; pages Territoires, Paramètres, Accueil rangées sous Administration.

### Phase B — Entites et Utilisateurs (à faire)
Décision du 2026-11-23 : Entité + Périmètre.
- les **bureaux** (table `Bureaux`, 24 lignes, déjà rattachés à une entité) deviennent des **sous-entités** de `Entites` ;
- `Utilisateurs.entites` (plusieurs entités) et `bureaux` → `Entite` (la principale) + `Perimetre` (les autres) ; `entites_vues` est remplacée par `Entites_vues` de la norme ;
- `par_bureau` (chefs limités à leurs bureaux) devient naturel : leur périmètre est leurs bureaux ;
- à réécrire : les règles d'accès qui lisent `entites_vues`, `bureaux`, `par_bureau`, et les références `bureau` → `Entite` dans Personnel et les sections ;
- ensuite seulement : Support, Support_commentaires, Journal_Admin, Documentation et l'attribut `user.Profil`.

### Phase C — nommage (P3)
Renommer les colonnes en `Majuscule_initiale` : Grist met à jour formules et règles, mais le code des widgets est à adapter en même temps.

## Rôles métier propres à l'application
- **Chef de bureau / Adjoint au chef de bureau** : signent les fiches des agents de leurs bureaux.
- **BSSIOM** : coche l'ouverture de chaque application après la signature de l'arrivée, et la fermeture des comptes au départ.
