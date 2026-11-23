# Dossier de norme — applications Grist DGOM

Ce dossier explique **pourquoi** et **comment** on norme nos documents Grist.
La structure technique des tables standard est dans `../structure/` ; ici, ce sont les règles écrites, les décisions et l'état de chaque application.

| Fichier | Contenu | Quand le mettre à jour |
|---|---|---|
| [`principes.md`](principes.md) | Les règles communes à toute application (nommage, traçabilité, droits, widgets…) | Quand une décision change une règle |
| [`decisions.md`](decisions.md) | Le journal des décisions, daté, avec la raison | **À chaque fois qu'on tranche quelque chose** |
| [`checklist-conformite.md`](checklist-conformite.md) | La grille pour auditer une application | Quand un principe est ajouté |
| [`retours-experience.md`](retours-experience.md) | Les pièges techniques rencontrés et comment les éviter | Après chaque incident ou découverte |
| [`applications/`](applications/) | Un fichier par application : état des écarts, plan de mise à la norme | À chaque audit ou mise à la norme |

## Comment on avance

1. **Auditer** une application : `scripts/auditer-norme.js` dans la console du document (voir le README du dépôt), complété par la checklist → fichier dans `applications/`.
2. **Décider** les points ouverts → une entrée dans `decisions.md` (et `principes.md` si la règle change).
3. **Appliquer** : d'abord ce qui ne fait qu'ajouter (tables standard, traçabilité), ensuite ce qui touche aux droits.
4. **Publier** : la structure via « 📤 Publier la norme » (Grist Gouvernance), ce dossier via Git.

Règle d'or : **la norme reste générique**. Ce qui ne sert qu'à une application (fiches, circuits métier) n'entre pas dans la norme.
