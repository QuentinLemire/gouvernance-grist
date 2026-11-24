/*
 * ❓ Aide — module de la console d'administration.
 * Le mode d'emploi est un texte fixe (admin/aide.html) : pour le faire évoluer, modifier ce fichier.
 * Ici, seulement les boutons « Ouvrir → », qui affichent l'outil demandé.
 */
document.getElementById('module-aide').addEventListener('click', (e) => {
  const b = e.target.closest('[data-aide-outil]');
  if (!b) return;
  e.preventDefault();   // un bouton dans un <summary> ouvrirait aussi la tâche
  Console.ouvrir(b.dataset.aideOutil);
});
