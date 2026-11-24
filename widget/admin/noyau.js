/*
 * =====================================================================
 *  Noyau de la console d'administration — Boîte à outils Grist V2 (DGOM)
 * =====================================================================
 *
 *  À quoi ça sert
 *  --------------
 *  La console (console.html) est une seule page Grist qui réunit tous les outils
 *  d'administration. Pour rester légère, elle ne charge un module que la première
 *  fois qu'on l'ouvre ; ensuite on passe d'un module à l'autre sans rien recharger.
 *  Ce noyau :
 *    - déclare la liste des modules et dessine le menu ;
 *    - charge un module à la demande (son affichage admin/<cle>.html, puis son code admin/<cle>.js) ;
 *    - ouvre directement un module demandé dans l'adresse (console.html?module=atelier) ;
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

window.Console = (() => {
  /**
   * Modules de la console, dans l'ordre du menu.
   * cle : nom des fichiers admin/<cle>.html et admin/<cle>.js ; rubrique : titre du groupe dans le menu ;
   * aVenir : module annoncé, pas encore livré (grisé dans le menu).
   */
  const MODULES = [
    { cle: 'tableau', titre: '🏠 Tableau de bord', rubrique: '', aVenir: true },
    { cle: 'utilisateurs', titre: '👥 Utilisateurs', rubrique: 'Personnes', aVenir: true },
    { cle: 'droits', titre: '🔐 Rôles et droits', rubrique: 'Personnes', aVenir: true },
    { cle: 'explorateur', titre: '🔍 Explorateur', rubrique: 'Données' },
    { cle: 'atelier', titre: '🏗️ Atelier', rubrique: 'Données' },
    { cle: 'sante', titre: '🩺 Santé du document', rubrique: 'Qualité', aVenir: true },
    { cle: 'support', titre: '🆘 Support', rubrique: 'Support', aVenir: true },
    { cle: 'maintenance', titre: '🧱 Maintenance', rubrique: 'Maintenance', aVenir: true },
    { cle: 'aide', titre: '❓ Aide', rubrique: '', aVenir: true },
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

  /** Charge un module : son affichage, puis son code. Une seule fois, même si on clique deux fois. */
  function charger(cle) {
    if (!charges.has(cle)) {
      charges.set(cle, (async () => {
        const r = await fetch(adresse('admin/' + cle + '.html'));
        if (!r.ok) throw new Error('affichage du module introuvable (' + r.status + ')');
        zone(cle).innerHTML = await r.text();
        await new Promise((ok, ko) => {
          const s = document.createElement('script');
          s.src = adresse('admin/' + cle + '.js');
          s.onload = ok;
          s.onerror = () => ko(new Error('code du module introuvable'));
          document.body.appendChild(s);
        });
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
    history.replaceState(null, '', '#' + m.cle);
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
  const demande = new URLSearchParams(location.search).get('module') || location.hash.slice(1);
  dessinerMenu();
  ouvrir(demande);

  return { zone, ouvrir, quandAffiche, ecrire, modules: MODULES };
})();
