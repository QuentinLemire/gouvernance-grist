# Arrivées-Départs MOM

- **Document** : https://grist.numerique.gouv.fr/o/arrivees-departsmom/7vFZ964YgDgJ/ArriveesdepartsMOM
- **Rôle** : fiches d'arrivée et de départ des agents (DGOM, SMA, CABMOM), circuit RH → bureau → BSSIOM, annuaire.
- **Dernier audit** : 2026-11-23 — **non conforme** (socle absent, structure propre).

## État par principe

| Principe | État | Détail |
|---|---|---|
| P1 Territoires | ❌ | Table absente |
| P1 Entites | ⚠️ | Modèle propre (`code`, `libelle`, `emetteur`, `utilise`, `etape_bureau`) ; colonnes de la norme absentes |
| P1 Utilisateurs | ⚠️ | Modèle propre (`email`, `nom`, `role`, `entites` multiples, `bureaux`, `qualite`…) ; colonnes de la norme absentes |
| P1 Parametres, Accueil, Support, Support_commentaires, Journal_Admin | ❌ | Tables absentes |
| P1 Documentation | ❌ | Absente (facultative) |
| P2 Traçabilité | ❌ | Aucune des 16 tables ; `Personnel` a `cree_le` / `cree_par` (mauvais nom, pas de modification) |
| P3 Nommage | ❌ | Colonnes en minuscules (`nom_complet`) |
| P5 Droits | ⚠️ | Attribut `user.Moi` (et non `user.Profil`) ; rôles : Admin, Gestionnaire, Lecteur (génériques) + Chef de bureau, Adjoint au chef de bureau, BSSIOM (métier) ; 224 règles d'accès |
| P6 Registre unique | ✅ | `PersonnelParti` fusionnée dans `Personnel` le 2026-11-23 |
| P7 Widgets | ⚠️ | Code de fiche commun à 4 pages (variantes par `data-type`) ✅ ; mais collé dans le document (7 exemplaires), pas chargé par URL |
| Formules en erreur | ✅ | Aucune |

## Plan de mise à la norme

1. **Sans risque (ajouts seulement)** : installer Territoires, Parametres, Accueil, Support, Support_commentaires, Journal_Admin (widget Administration → « Installer ») ; ajouter la traçabilité aux tables métier.
2. **Entites et Utilisateurs** (décision du 2026-11-23 : Entité + Périmètre) :
   - les **bureaux** (table `Bureaux`, 24 lignes, déjà rattachés à une entité) deviennent des **sous-entités** de `Entites` ;
   - `Utilisateurs.entites` (plusieurs entités) et `bureaux` → `Entite` (la principale) + `Perimetre` (les autres) ; `entites_vues` est remplacée par `Entites_vues` de la norme ;
   - `par_bureau` (chefs limités à leurs bureaux) devient naturel : leur périmètre est leurs bureaux ;
   - à réécrire : les règles d'accès qui lisent `entites_vues`, `bureaux`, `par_bureau`, et les références `bureau` → `Entite` dans Personnel et les sections.
3. **Plus tard** : nommage (P3) et `user.Profil` (P5) — touchent toutes les formules et règles ; à faire en une fois.

## Rôles métier propres à l'application
- **Chef de bureau / Adjoint au chef de bureau** : signent les fiches des agents de leurs bureaux.
- **BSSIOM** : coche l'ouverture de chaque application après la signature de l'arrivée, et la fermeture des comptes au départ.
