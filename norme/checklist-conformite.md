# Checklist de conformité

À dérouler pour chaque application. Résultat à noter dans `applications/<nom>.md` (✅ conforme, ⚠️ partiel, ❌ absent).

## Socle (P1)
- [ ] Entites : `Nom`, `Parent`, `Nom_complet`, `Actif`, `Membres`, `Nbre`
- [ ] Utilisateurs : `Nom`, `Email`, `Entite`, `Perimetre`, `Entites_vues`, `Role`, `Actif`, `Email_cle`, `Courriel_valide`, `Doublon`
- [ ] Bureaux et services rangés comme sous-entités (`Entites.Parent`), pas dans une table à part
- [ ] Parametres (avec `Nom_application`, `Contact_support`, `Logo_DGOM`) et Accueil
- [ ] Journal_Admin
- [ ] Pages : Accueil, Administration › Utilisateurs, Boîte à outils

## Hors socle (si installés, ils doivent être complets)
- [ ] Support + Support_commentaires (page Support sous l'Accueil)
- [ ] Documentation (page sous l'Accueil)
- [ ] Territoires (13 territoires) et `Entites.Territoire`

## Traçabilité (P2)
- [ ] Chaque table métier a `CreeLe`, `CreePar`, `ModifieLe`, `ModifiePar`
- [ ] `ModifieLe` / `ModifiePar` en recalcul à chaque modification

## Nommage et ordre (P3, P4)
- [ ] Socle et nouvelles colonnes en `Majuscule_initiale`, sans accent (colonnes métier existantes tolérées)
- [ ] Ordre : identification → contenu → liens → état → traçabilité

## Droits (P5)
- [ ] Attribut utilisateur `user.Profil` sur Utilisateurs.Email
- [ ] Rôles génériques présents ; rôles métier documentés
- [ ] Règles par entité écrites avec `user.Profil.Entites_vues`
- [ ] Personne non inscrite : seule la page d'accueil est visible
- [ ] Aucune formule de règle d'accès en erreur

## Données (P6)
- [ ] Pas de table recopiée d'une autre (un registre + un état)
- [ ] Aucune formule en erreur

## Widgets (P7)
- [ ] Widgets génériques chargés par URL depuis ce dépôt
- [ ] Un seul code par widget métier (variantes par réglage) ; il peut rester collé dans le document
