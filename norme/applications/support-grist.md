# Support Grist DGOM (bac à sable : espace Arrivées-Départs)

Document normé (copie du Modèle DGOM, mis à la norme par la Maintenance), lien : /o/arrivees-departsmom/ii79VDftXMj9.
Inscrit dans la liste Grist DGOM de Gouvernance : GOUV_Utilisateur y inscrit tous les agents (annuaire) et les entités.

## Rôles
- **Référents d'un Grist** : choisis dans Maintenance › Paramètres de chaque Grist (clé `Referents`, 3 au plus).
  Le flow n8n **GOUV_Referents** lit la liste Grist DGOM puis les référents de chaque Grist, et tient deux tables du Support :
  `Grist_suivis` (un Grist par ligne, avec ses référents) et `Referents` (une personne par ligne, avec ses Grist).
  Lignes « Ajouté par n8n » seulement ; une ligne saisie à la main n'est jamais touchée.
- **BSSIOM** : les administrateurs Grist (case de la fiche d'arrivée, recopiée dans Utilisateurs). Eux seuls voient toutes les demandes et répondent (statut, réponse) ; être propriétaire du document ne suffit pas.
- **Tout inscrit** peut demander la création d'un Grist.

## Tables (hors norme)
- `Demandes` : Type (« Demande sur un Grist » / « Création d'un Grist »), Grist, Objet, Description ; pour une création :
  Bureau, Nombre d'utilisateurs, hors bureau, hors ministère, données personnelles, durée, automatisation, lien avec
  d'autres Grist ; `Criteres_remplis` et `Prise_en_charge` (calculées) ; Statut, Réponse ; traçabilité.
- `Regles_prise_en_charge` : une règle par ligne (élément de la demande, seuil éventuel, active) ; une seule règle remplie
  suffit pour que le BSSIOM prenne le Grist en charge. Règles de départ : plus de 10 utilisateurs, plusieurs bureaux,
  utilisateurs hors ministère, données personnelles, automatisation, lien avec d'autres Grist.

## Règles d'accès (attributs `Profil` = Utilisateurs, `Referent` = Referents)
- Demandes : le BSSIOM voit et traite tout ; une demande de création se crée par tout inscrit ; une demande sur un Grist,
  par ses seuls référents ; chacun voit les siennes, les référents voient celles de leurs Grist ; on modifie sa demande
  tant qu'elle est « Nouvelle » ; seul le BSSIOM change Statut et Réponse.
- Chacun lit sa ligne d'Utilisateurs (Est moi) et, s'il est référent, sa ligne de Referents.

## Widget (page 🎫 Demandes)
Custom widget builder, code dans le dépôt privé (`support/support.html`, `support/support.js`) : mes demandes,
nouvelle demande (sur un de mes Grist / nouveau Grist, avec la prise en charge calculée en direct), mes Grist,
toutes les demandes (BSSIOM : compteurs, filtres, statut et réponse), règles de prise en charge.

## Reste à faire
- Partager le document (lecture-écriture) avec les agents qui doivent pouvoir faire des demandes.
- Lien « Support » sur l'accueil de chaque Grist, réservé à ses référents.
- Publier GOUV_Referents (et GOUV_Utilisateur) quand tout est validé ; déplacer le document hors du bac à sable.
