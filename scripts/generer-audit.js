/*
 * Fabrique scripts/auditer-norme.js : en-tête + règles de la norme (widget/commun/norme.js)
 * + point d'entrée (scripts/audit/entree.js). À relancer après toute modification de norme.js :
 *     node scripts/generer-audit.js
 */
const fs = require('fs');
const path = require('path');
const ici = (f) => path.join(__dirname, f);
const contenu = [
  fs.readFileSync(ici('audit/entete.js'), 'utf8'),
  fs.readFileSync(ici('../widget/commun/norme.js'), 'utf8'),
  fs.readFileSync(ici('audit/entree.js'), 'utf8'),
].join('\n');
fs.writeFileSync(ici('auditer-norme.js'), contenu);
console.log('scripts/auditer-norme.js refait (' + contenu.split('\n').length + ' lignes).');
