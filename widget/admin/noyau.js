/*
 * =====================================================================
 *  Noyau de la console d'administration — Boîte à outils Grist V2 (DGOM)
 * =====================================================================
 *
 *  À quoi ça sert
 *  --------------
 *  console.html sert les outils d'administration de deux façons :
 *    - une page par outil (recommandé) : console.html?module=atelier n'affiche que l'Atelier,
 *      sans menu ; la page ne charge que le socle et ce module ;
 *    - la console complète (console.html sans module) : un menu à gauche, chaque module chargé
 *      la première fois qu'on l'ouvre.
 *  Un lien d'un outil vers un autre (« Corriger → ») ouvre l'autre module sur place.
 *  Ce noyau :
 *    - déclare la liste des modules et dessine le menu ;
 *    - charge un module à la demande (son affichage admin/<cle>.html, puis son code admin/<cle>.js) ;
 *    - charge d'abord les fichiers dont un module dépend (le moteur admin/gestion.js) ;
 *    - écrit dans le document en journalisant TOUJOURS l'action (Console.ecrire) ;
 *    - expose les raccourcis du socle aux modules (avis, demander, identifiant, escapeHtml).
 *
 *  Écrire un module
 *  ----------------
 *  1. admin/<cle>.html : son affichage (balises et <style>), sans <html> ni <body>.
 *  2. admin/<cle>.js   : son code, exécuté une fois, après l'insertion de l'affichage.
 *     Il peut appeler Console.quandAffiche('<cle>', fonction) pour être prévenu à chaque affichage.
 *  3. une ligne dans MODULES ci-dessous.
 *  Les noms (fonctions, variables, identifiants HTML) doivent être propres au module : tous
 *  les modules partagent la même page.
 */

// Raccourcis du socle, déclarés une seule fois pour tous les modules
const { avis, demander, identifiant } = Outils;
const escapeHtml = Outils.esc;

grist.ready({ requiredAccess: 'full' });

// Une erreur inattendue ne doit jamais passer inaperçue : elle s'affiche dans le bandeau (avec le
// fichier et la ligne, pour pouvoir la corriger), au lieu de laisser une page figée sur « Chargement… ».
window.addEventListener('error', (e) => avis('Erreur : ' + e.message + (e.filename ? ' (' + e.filename.split('/').pop().split('?')[0] + ', ligne ' + e.lineno + ')' : ''), 'erreur'));
window.addEventListener('unhandledrejection', (e) => avis('Erreur : ' + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason), 'erreur'));

window.Console = (() => {
  /**
   * Modules, dans l'ordre du menu.
   * cle : nom des fichiers admin/<cle>.html et admin/<cle>.js ; rubrique : titre du groupe dans le menu ;
   * avec : fichiers à charger d'abord (le moteur de l'administration) ; aVenir : pas encore livré.
   */
  const NORME = ['commun/norme.js'];   // règles de la norme (commun avec scripts/auditer-norme.js)
  const GESTION = [...NORME, 'admin/gestion.js'];
  const MODULES = [
    { cle: 'tableau', titre: '🏠 Tableau de bord', rubrique: '', avec: GESTION },
    { cle: 'utilisateurs', titre: '👥 Utilisateurs', rubrique: 'Personnes', avec: GESTION },
    { cle: 'droits', titre: '🔐 Rôles et droits', rubrique: 'Personnes', avec: GESTION },
    { cle: 'explorateur', titre: '🔍 Explorateur', rubrique: 'Données' },
    { cle: 'atelier', titre: '🏗️ Atelier', rubrique: 'Données' },
    { cle: 'sante', titre: '🩺 Santé du document', rubrique: 'Qualité', avec: NORME },
    { cle: 'support', titre: '🆘 Support', rubrique: 'Support', avec: GESTION },
    { cle: 'maintenance', titre: '🧱 Maintenance', rubrique: 'Maintenance', avec: GESTION },
    { cle: 'aide', titre: '❓ Aide', rubrique: '', avec: GESTION },
  ];

  // Version de la page (?v=…) : les fichiers des modules sont chargés avec la même, jamais une ancienne copie
  const VERSION = new URLSearchParams(location.search).get('v') || '';
  const adresse = (chemin) => chemin + (VERSION ? '?v=' + VERSION : '');

  const charges = new Map();      // cle → promesse de chargement (un module n'est chargé qu'une fois)
  const surAffichage = new Map(); // cle → fonctions appelées à chaque affichage du module
  let courant = null;

  /** Zone d'affichage d'un module (créée au besoin, masquée tant qu'il n'est pas affiché). */
  function zone(cle) {
    let z = document.getElementById('module-' + cle);
    if (!z) {
      z = document.createElement('section');
      z.id = 'module-' + cle;
      z.className = 'module';
      z.hidden = true;
      document.getElementById('modules').appendChild(z);
    }
    return z;
  }

  const scripts = new Map();      // fichier → promesse : chaque script n'est chargé qu'une fois
  /** Charge un script (avec la version de la page), une seule fois. */
  function script(chemin) {
    if (!scripts.has(chemin)) {
      scripts.set(chemin, new Promise((ok, ko) => {
        const s = document.createElement('script');
        s.src = adresse(chemin);
        s.onload = ok;
        s.onerror = () => { scripts.delete(chemin); ko(new Error('fichier introuvable : ' + chemin)); };
        document.body.appendChild(s);
      }));
    }
    return scripts.get(chemin);
  }

  /** Charge un module : ses dépendances, son affichage, puis son code. Une seule fois. */
  function charger(cle) {
    if (!charges.has(cle)) {
      const m = MODULES.find((x) => x.cle === cle);
      charges.set(cle, (async () => {
        const r = await fetch(adresse('admin/' + cle + '.html'));
        if (!r.ok) throw new Error('affichage du module introuvable (' + r.status + ')');
        zone(cle).innerHTML = await r.text();
        for (const d of m.avec || []) await script(d);
        await script('admin/' + cle + '.js');
      })());
    }
    return charges.get(cle);
  }

  /** Affiche un module (en le chargeant la première fois) et met le menu et l'adresse à jour. */
  async function ouvrir(cle) {
    const m = MODULES.find((x) => x.cle === cle) || MODULES.find((x) => !x.aVenir);
    if (m.aVenir) return avis('« ' + m.titre.replace(/^\S+\s/, '') + ' » arrive bientôt dans la console.', 'info');
    courant = m.cle;
    dessinerMenu();
    const z = zone(m.cle);   // créée d'abord, pour être prise en compte ci-dessous
    document.querySelectorAll('#modules > .module').forEach((x) => { x.hidden = x !== z; });
    if (!charges.has(m.cle)) z.innerHTML = '<p class="discret" style="padding:24px">Chargement…</p>';
    try {
      await charger(m.cle);
      (surAffichage.get(m.cle) || []).forEach((f) => f());
    } catch (e) {
      charges.delete(m.cle);
      z.innerHTML = '<div class="encadre erreur" style="margin:24px">Le module n\'a pas pu être chargé : ' + escapeHtml(e.message) + '</div>';
    }
    if (!document.body.classList.contains('page-unique')) history.replaceState(null, '', '#' + m.cle);
  }

  /** Menu de gauche : les modules groupés par rubrique ; ceux à venir sont grisés. */
  function dessinerMenu() {
    let rubrique = null, html = '';
    for (const m of MODULES) {
      if (m.rubrique !== rubrique) { rubrique = m.rubrique; if (rubrique) html += `<h3>${escapeHtml(rubrique)}</h3>`; }
      html += `<button data-module="${m.cle}" class="${m.cle === courant ? 'actif' : ''} ${m.aVenir ? 'a-venir' : ''}"` +
        `${m.aVenir ? ' title="Bientôt disponible"' : ''}>${escapeHtml(m.titre)}</button>`;
    }
    document.getElementById('menu').innerHTML = html;
  }

  /** Un module demande à être prévenu à chaque affichage (ex. recadrer un schéma). */
  function quandAffiche(cle, fonction) {
    if (!surAffichage.has(cle)) surAffichage.set(cle, []);
    surAffichage.get(cle).push(fonction);
  }

  /**
   * Écrit dans le document ET le note au journal d'administration (table Gouv_Journal, si elle
   * existe) : toute modification faite depuis la console laisse une trace.
   * @param {Array} actions   actions Grist (applyUserActions)
   * @param {string} action   intitulé court du journal (« Table créée »…)
   * @param {string} [detail] précision
   */
  async function ecrire(actions, action, detail = '') {
    const resultat = await grist.docApi.applyUserActions(actions);
    try {
      await grist.docApi.applyUserActions([['AddRecord', 'Gouv_Journal', null, { Date: Date.now() / 1000, Action: action, Detail: detail }]]);
    } catch (e) { /* pas de journal dans ce document : l'écriture elle-même a réussi */ }
    return resultat;
  }

  // Démarrage : menu, puis le module demandé dans l'adresse (?module=… ou #…), sinon le premier disponible
  document.getElementById('menu').addEventListener('click', (e) => {
    const b = e.target.closest('[data-module]');
    if (b) ouvrir(b.dataset.module);
  });
  // Une page par outil : ?module=… n'affiche que ce module, sans menu.
  const demande = new URLSearchParams(location.search).get('module');
  if (demande) document.body.classList.add('page-unique');
  dessinerMenu();
  ouvrir(demande || location.hash.slice(1));

  return { zone, ouvrir, charger, quandAffiche, ecrire, modules: MODULES };
})();
