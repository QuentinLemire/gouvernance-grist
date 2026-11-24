/* =====================================================================
   AUDIT DE CONFORMITÉ À LA NORME DGOM — applications Grist
   =====================================================================
   FICHIER FABRIQUÉ : ne pas le modifier à la main.
   Les règles viennent de widget/commun/norme.js (les mêmes que la page
   🩺 Santé du document) ; ce point d'entrée vient de scripts/audit/.
   Pour le refaire :  node scripts/generer-audit.js

   À QUOI SERT CE SCRIPT
   ---------------------
   Il compare un document Grist à la norme (structure/*.json et
   norme/principes.md) et dresse l'état des écarts, principe par principe
   (P1 à P7), plus les formules en erreur et les colonnes inutilisées.
   Il ne fait que LIRE : rien n'est envoyé au document.
   Utile pour un document qui n'a pas encore les outils d'administration ;
   sinon, la page 🩺 Santé du document fait la même chose en mieux.

   COMMENT L'UTILISER
   ------------------
   1. Ouvrir le document Grist à auditer (droit de lecture au moins ;
      les propriétaires voient en plus les règles d'accès).
   2. Ouvrir la console du navigateur (F12, onglet « Console »).
   3. Coller tout ce fichier, puis lancer :

        const audit = await auditerNorme();

      Le tableau s'affiche dans la console ; le texte Markdown, prêt à coller
      dans norme/applications/<application>.md, est dans audit.markdown
      (copy(audit.markdown) le copie directement).

   Options : auditerNorme({ docId: 'abc…', depot: 'https://…/' })
     - docId : auditer un autre document que celui ouvert ;
     - depot : lire la norme ailleurs (par défaut, la branche main sur GitHub).
   ===================================================================== */

