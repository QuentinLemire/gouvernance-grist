# Checklist de conformité

À dérouler pour chaque application. Résultat à noter dans `applications/<nom>.md` (✅ conforme, ⚠️ partiel, ❌ absent).

## Socle (P1)
- [ ] Territoires présente, données à jour (13 territoires)
- [ ] Entites : `Nom`, `Parent`, `Nom_complet`, `Territoire`, `Actif`, `Membres`, `Nbre`
- [ ] Utilisateurs : `Nom`, `Email`, `Entite`, `Role`, `Actif`, `Email_cle`, `Courriel_valide`, `Doublon`
- [ ] Parametres (avec `Nom_application`, `Contact_support`, `Logo_DGOM`)
- [ ] Accueil
- [ ] Support + Support_commentaires
- [ ] Journal_Admin
- [ ] Documentation (facultatif)

## Traçabilité (P2)
- [ ] Chaque table métier a `CreeLe`, `CreePar`, `ModifieLe`, `ModifiePar`
- [ ] `ModifieLe` / `ModifiePar` en recalcul à chaque modification

## Nommage et ordre (P3, P4)
- [ ] Colonnes en `Majuscule_initiale`, sans accent
- [ ] Ordre : identification → contenu → liens → état → traçabilité

## Droits (P5)
- [ ] Attribut utilisateur `user.Profil` sur Utilisateurs.Email
- [ ] Rôles génériques présents ; rôles métier documentés
- [ ] Personne non inscrite : seule la page d'accueil est visible
- [ ] Aucune formule de règle d'accès en erreur

## Données (P6)
- [ ] Pas de table recopiée d'une autre (un registre + un état)
- [ ] Aucune formule en erreur

## Widgets (P7)
- [ ] Widgets génériques chargés par URL depuis ce dépôt
- [ ] Un seul code par widget métier (variantes par réglage)
