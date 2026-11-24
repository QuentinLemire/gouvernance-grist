/*
 * =====================================================================
 *  Moteur de l'administration — console d'administration (DGOM)
 * =====================================================================
 *  Partagé par les modules Tableau de bord, Utilisateurs, Rôles et droits, Support, Maintenance et
 *  Aide (chargé une seule fois, avant le premier d'entre eux) : configuration de la norme, état,
 *  outils, lecture du document, enregistrement des champs et réaction aux boutons (data-action).
 *  Chaque module n'apporte que sa vue (ongletXxx) et la déclare avec declarerVue().
 *  Reprise de l'ancien panneau administration.html (Quentin Lemire, 24/11/2026).
 * =====================================================================
 */
// --- 1. Configuration ----------------------------------------------------------------------------

/**
 * Mention placée en tête du mémo de chaque règle d'accès écrite par ce panneau.
 * C'est elle qui permet de retrouver « nos » règles pour les réécrire ou les retirer
 * sans toucher aux règles posées à la main dans Grist.
 */
const MARQUE = '[Admin]';
/**
 * Mention des règles de protection des données (ex. « on ne supprime pas un bureau utilisé ») :
 * elles passent avant celles du panneau, qui ne les touche pas.
 */
const INTEGRITE = '[Intégrité]';

/**
 * Nom de l'attribut utilisateur Grist. Une fois déclaré, user.Profil désigne la ligne de la
 * table Utilisateurs dont le courriel est celui de la personne connectée : les règles
 * d'accès peuvent alors tester user.Profil.Role ou user.Profil.Actif.
 */
const ATTRIBUT = 'Profil';

/**
 * Dépôt Git de la norme : GitHub public, lu sans authentification par toutes les applications.
 * Seul le document source de la norme (Parametres : Source_norme = oui) publie ; il lui faut
 * un jeton GitHub (Parametres : Github_jeton, droit « Contents : write » sur ce seul dépôt).
 * Plus tard, un GitLab : renseigner Gitlab_API, Gitlab_projet (et Gitlab_jeton pour publier).
 */
const GITHUB = { proprietaire: 'QuentinLemire', depot: 'gouvernance-grist', branche: 'main' };
// Adresse de lecture directe des fichiers du dépôt, et page web du dépôt (pour y déposer des fichiers à la main).
const DEPOT = `https://raw.githubusercontent.com/${GITHUB.proprietaire}/${GITHUB.depot}/${GITHUB.branche}/`;
const PAGE_DEPOT = `https://github.com/${GITHUB.proprietaire}/${GITHUB.depot}`;
// Les widgets sont servis par GitHub Pages (raw.githack, utilisé jusqu'au 24/11/2026, est tombé en panne).
// Le commit est noté dans l'adresse (?v=…) : nouvelle adresse à chaque version, donc jamais d'ancienne copie
// gardée par le navigateur, et la version des pages reste lisible dans l'onglet Structure.
const SITE_WIDGETS = `https://${GITHUB.proprietaire.toLowerCase()}.github.io/${GITHUB.depot}/widget/`;
const URL_WIDGET = (version, fichier) => `${SITE_WIDGETS}${fichier}?v=${version}`;
// Reconnaît une adresse de widget de la norme : GitHub Pages (fichier, version) ou ancienne adresse raw.githack (version, fichier).
const ADRESSE_WIDGET = new RegExp(`(?:/${GITHUB.proprietaire}/${GITHUB.depot}/([^/]+)|${GITHUB.proprietaire}\\.github\\.io/${GITHUB.depot})/widget/([^?#]+)(?:\\?v=([0-9a-f]+))?`, 'i');

/**
 * Sujets transverses de la norme, dans l'ordre d'installation conseillé.
 * « fichier » : nom du fichier structure/<fichier>.json sur le dépôt ;
 * « obligatoire » : sujet du socle, dont l'absence est signalée au tableau de bord.
 */
/**
 * Version de ce code. À changer à chaque modification du fichier : avant de publier, la page compare
 * cette valeur à celle du fichier sur le dépôt et refuse de publier avec une copie périmée
 * (GitHub Pages peut servir l'ancienne copie une à deux minutes après un commit).
 */
const VERSION_WIDGET = '2026-11-24.4';

const SUJETS = [
  // Socle : présent dans toute application.
  { fichier: 'utilisateurs', nom: 'Utilisateurs & entités', obligatoire: true },
  { fichier: 'parametres', nom: "Paramètres (nom, contact, logo : lus par la page d'accueil)", obligatoire: true },
  { fichier: 'accueil_public', nom: "Page d'accueil publique", obligatoire: true },
  { fichier: 'journal', nom: "Journal d'administration", obligatoire: true },
  // Hors socle : à installer si l'application en a besoin (bouton « Installer »).
  { fichier: 'referentiel_territoires', nom: 'Territoires ultramarins (ajoute aussi Entites.Territoire)', obligatoire: false },
  { fichier: 'support', nom: 'Support', obligatoire: false },
  { fichier: 'documentation', nom: 'Documentation', obligatoire: false },
];

/** Données de référence livrées avec certains sujets (dossier donnees/ du dépôt), chargées à l'installation si la table est vide. */
const DONNEES = { referentiel_territoires: 'territoires.json', documentation: 'documentation.json' };   // documentation : une page modèle « à modifier »

/**
 * Niveaux de droit proposés dans la matrice, et leur traduction en permissions Grist.
 * Lettres Grist : C = créer, R = lire, U = modifier, D = supprimer ; « + » accorde, « - » refuse.
 * Le niveau « hérité » n'écrit aucune règle : ce sont les règles suivantes qui décident.
 */
const NIVEAUX = [
  { code: '',       libelle: '— hérité',            perm: null },
  { code: 'aucun',  libelle: '🚫 Aucun accès',       perm: '-CRUD' },
  { code: 'lire',   libelle: '👁️ Lecture',           perm: '+R-CUD' },
  { code: 'ajout',  libelle: '➕ Lecture + ajout',   perm: '+CR-UD' },
  { code: 'modif',  libelle: '✏️ Modifier',          perm: '+CRU-D' },
  { code: 'tout',   libelle: '🗑️ Tout',              perm: '+CRUD' },
];
/** Correspondance inverse permission Grist → niveau, pour relire les règles déjà écrites. */
const NIVEAU_DE_PERM = Object.fromEntries(NIVEAUX.filter((n) => n.perm).map((n) => [n.perm, n.code]));

/**
 * Tables jamais gérées par la matrice, qui ont leurs propres règles [Gouvernance] :
 * la page d'accueil, lisible par tous, et la documentation, lisible par les inscrits et
 * modifiable par les seuls propriétaires du document (voir reglesDocumentation).
 */
const HORS_MATRICE = ['Gouv_Accueil', 'Gouv_Documentation'];
/**
 * Tables qui ont des règles propres à l'application (ni [Admin] ni [Gouvernance]), par exemple les fiches
 * d'Arrivées-Départs (droits par entité, bureau, étape). Le panneau ne les modifie pas : ses règles passent
 * avant les autres et les écraseraient. Elles se gèrent dans Permissions avancées.
 * @returns {Map<string, number>} table → nombre de règles propres
 */
function tablesMetier() {
  const m = new Map();
  for (const r of etat.acl.regles || []) {
    const res = ressource(r.resource), t = res?.tableId, memo = String(r.memo || '');
    // Les règles sur quelques colonnes (ex. Utilisateurs.Est_moi) passent avant celles de la table : elles ne gênent pas le panneau.
    if (!t || t === '*' || res.colIds !== '*' || memo.startsWith(MARQUE) || memo.startsWith('[Gouvernance]') || memo.startsWith(INTEGRITE)) continue;
    if (!(r.aclFormula || r.permissionsText)) continue;
    m.set(t, (m.get(t) || 0) + 1);
  }
  return m;
}
/** Tables du document couvertes par la matrice des droits (hors tables à règles métier). */
const tablesGerees = () => etat.meta.tables.map((t) => t.tableId).filter((t) => !HORS_MATRICE.includes(t) && !tablesMetier().has(t));
/** Vrai si la garde est posée : une personne non inscrite, inactive ou sans rôle ne voit que l'accueil. */
const gardePresente = () => (etat.acl.regles || []).some((r) => ressource(r.resource)?.tableId === '*' && /not user\.Profil\b/.test(r.aclFormula || ''));
/** Vrai si une règle (du panneau ou non) réserve à chacun ses propres demandes de support. */
const supportPrivePresent = () => (etat.acl.regles || []).some((r) => /rec\.Demandeur != user\.Email/.test(r.aclFormula || ''));

/**
 * Colonnes de traçabilité ajoutées à la demande sur une table (onglet Structure).
 * recalcWhen 0 : valeur calculée une seule fois, à la création de la ligne ;
 * recalcWhen 2 : recalculée à chaque modification de la ligne.
 */
const TRACABILITE = [
  { id: 'CreeLe', label: 'Créé le', type: 'DateTime:Europe/Paris', formula: 'NOW()', recalcWhen: 0 },
  { id: 'CreePar', label: 'Créé par', type: 'Text', formula: 'user.Email', recalcWhen: 0 },
  { id: 'ModifieLe', label: 'Modifié le', type: 'DateTime:Europe/Paris', formula: 'NOW()', recalcWhen: 2 },
  { id: 'ModifiePar', label: 'Modifié par', type: 'Text', formula: 'user.Email', recalcWhen: 2 },
];

// --- 2. État du panneau --------------------------------------------------------------------------

/**
 * État du panneau : ce qui a été lu dans le document et ce que la personne a choisi à l'écran.
 * Chaque onglet est redessiné entièrement à partir de cet objet.
 * etat.ticket (demande affichée dans l'onglet Support) s'y ajoute en cours d'utilisation.
 */
const etat = {
  onglet: 'accueil',
  meta: { tables: [], parId: {}, colonnesParId: {} },  // structure du document
  d: {},                                              // données des tables utiles
  acl: { ressources: [], regles: [] },                // règles d'accès
  droits: null,                                       // matrice en cours d'édition
  filtres: { texte: '', role: '', statut: 'actifs', support: 'ouverts' },
  selection: new Set(),                               // utilisateurs cochés
  sujets: null,                                       // sujets lus sur le dépôt
  pages: null,                                        // pages du menu (onglet Structure)
};

// --- 3. Outils -----------------------------------------------------------------------------------

// Petits raccourcis utilisés partout :
//   $           élément de la page par son identifiant
//   esc         neutralise les caractères HTML d'un texte saisi (il ne peut ni casser la page ni y injecter du code)
//   json        lit un texte JSON sans planter (valeur par défaut si illisible)
//   liste       convertit une liste Grist ['L', a, b] en [a, b]
//   estCourriel contrôle le format d'une adresse
//   cle         forme normalisée d'un texte pour les comparaisons (minuscules, sans espaces autour)
//   dateFr      horodatage Grist (en secondes) → date et heure à la française
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = (s, defaut) => { try { return s ? JSON.parse(s) : defaut; } catch (e) { return defaut; } };
const liste = (v) => (Array.isArray(v) ? (v[0] === 'L' ? v.slice(1) : v) : []);
const estCourriel = (s) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(s || '').trim());
const cle = (s) => String(s || '').trim().toLowerCase();
const dateFr = (t) => (t ? new Date(t * 1000).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '');

/**
 * Grist renvoie les tables « en colonnes » ({ id: [...], Nom: [...] }) ;
 * on les remet en lignes { id, Col1, Col2… }, plus simples à parcourir.
 * @param {object} table  table au format colonnes renvoyée par fetchTable
 * @returns {object[]}    une entrée par ligne
 */
function enLignes(table) {
  const ids = table.id || [];
  return ids.map((id, i) => Object.fromEntries(Object.keys(table).map((k) => [k, table[k][i]])));
}

/**
 * Lit une table du document.
 * @param {string} tableId  identifiant Grist de la table (tables techniques _grist_… comprises)
 * @returns {Promise<object[]|null>}  les lignes, ou null si la table n'existe pas ou si les droits l'interdisent
 */
async function lire(tableId) {
  try { return enLignes(await grist.docApi.fetchTable(tableId)); } catch (e) { return null; }
}

/**
 * Envoie des actions Grist (AddRecord, UpdateRecord…) en une seule transaction :
 * tout passe ou rien ne passe, et l'utilisateur peut annuler avec Ctrl+Z.
 * @param {Array[]} actions  actions au format Grist
 */
const agir = (actions) => grist.docApi.applyUserActions(actions);

/**
 * Note une action d'administration dans Journal_Admin ; la date et l'auteur sont remplis
 * par les formules de la table. Silencieux si la table n'existe pas ou si l'écriture échoue :
 * la trace ne doit jamais bloquer l'action elle-même.
 * @param {string} action  libellé court (« Droits appliqués »…)
 * @param {string} detail  précisions libres
 */
async function tracer(action, detail = '') {
  if (!aTable('Gouv_Journal')) return;
  try { await agir([['AddRecord', 'Gouv_Journal', null, { Action: action, Detail: detail }]]); } catch (e) { /* non bloquant */ }
}

/**
 * Message à l'écran, par le bandeau commun de la console (Outils.avis).
 * @param {string} texte    texte du message (les balises éventuelles sont retirées)
 * @param {boolean} erreur  vrai pour un message d'erreur
 */
function message(texte, erreur = false) {
  avis(String(texte).replace(/<[^>]+>/g, ''), erreur ? 'erreur' : 'ok');
}

/**
 * Exécute une action longue : le bouton est grisé (« … ») pendant l'opération pour éviter
 * un double clic, et toute erreur est affichée à l'écran au lieu de passer inaperçue.
 * @param {HTMLElement|null} bouton  bouton à neutraliser (facultatif)
 * @param {Function} fn              traitement asynchrone à lancer
 * @returns {Promise<*>}             ce que renvoie fn (rien en cas d'erreur)
 */
async function occupe(bouton, fn) {
  const texte = bouton?.textContent;
  if (bouton) { bouton.disabled = true; bouton.textContent = '…'; }
  try { return await fn(); }
  catch (e) { console.error(e); message('❌ ' + esc(e.message || e), true); }
  finally { if (bouton) { bouton.disabled = false; bouton.textContent = texte; } }
}

/**
 * Fait télécharger un fichier texte par le navigateur (export CSV, fichiers de la norme).
 * @param {string} nom      nom du fichier proposé
 * @param {string} contenu  texte du fichier
 * @param {string} type     type MIME (texte brut par défaut)
 */
function telecharger(nom, contenu, type = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenu], { type: type + ';charset=utf-8' }));
  a.download = nom; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// --- 4. Chargement de la structure et des données ------------------------------------------------

// Accès rapides à la structure chargée :
//   aTable  la table existe-t-elle dans le document ?
//   colonne description d'une colonne (ligne de _grist_Tables_column), ou undefined
//   choix   valeurs proposées par une colonne « liste de choix »
//   roles   rôles définis dans les choix de la colonne Utilisateurs.Role
const aTable = (t) => !!etat.meta.parId[t];
const colonne = (t, c) => (etat.meta.parId[t]?.colonnes || []).find((x) => x.colId === c);
const choix = (t, c) => json(colonne(t, c)?.widgetOptions, {}).choices || [];
const roles = () => choix('Gouv_Utilisateurs', 'Role');

/**
 * Lit la structure du document dans les tables techniques de Grist et la range dans etat.meta :
 * tables visibles (hors tables techniques et tables de synthèse), avec leurs colonnes dans l'ordre.
 * @throws si la structure est illisible (widget non réglé sur « Accès complet au document »)
 */
async function chargerStructure() {
  const [tables, colonnes] = await Promise.all([lire('_grist_Tables'), lire('_grist_Tables_column')]);
  if (!tables) throw new Error("Lecture de la structure impossible : réglez le widget sur « Accès complet au document ».");
  const parTable = {};
  for (const c of colonnes) (parTable[c.parentId] = parTable[c.parentId] || []).push(c);
  const visibles = tables.filter((t) => t.tableId && !t.tableId.startsWith('_grist') && !(t.summarySourceTable > 0));
  for (const t of visibles) {
    t.colonnes = (parTable[t.id] || [])
      .filter((c) => c.colId !== 'manualSort' && !c.colId.startsWith('gristHelper_'))
      .sort((a, b) => (a.parentPos || 0) - (b.parentPos || 0));
  }
  etat.meta = {
    tables: visibles.sort((a, b) => a.tableId.localeCompare(b.tableId)),
    parId: Object.fromEntries(visibles.map((t) => [t.tableId, t])),
    colonnesParId: Object.fromEntries(colonnes.map((c) => [c.id, c])),
  };
}

/**
 * Charge dans etat.d les tables utiles au panneau (celles qui existent), et dans etat.acl
 * les règles d'accès. Pour une personne non propriétaire, etat.acl.regles vaut null :
 * Grist ne laisse lire les règles d'accès qu'aux propriétaires.
 */
async function chargerDonnees() {
  const utiles = ['Gouv_Utilisateurs', 'Gouv_Entites', 'Gouv_Territoires', 'Gouv_Support', 'Gouv_Support_commentaires', 'Gouv_Journal', 'Gouv_Parametres'];
  etat.d = {};
  await Promise.all(utiles.filter(aTable).map(async (t) => { etat.d[t] = (await lire(t)) || []; }));
  etat.acl = { ressources: (await lire('_grist_ACLResources')) || [], regles: await lire('_grist_ACLRules') };
}

/**
 * Recharge tout (structure puis données) et redessine l'onglet courant.
 * Appelé au démarrage, après chaque écriture et quand Grist signale un changement.
 * La matrice des droits et la liste des pages sont oubliées pour être relues à neuf.
 */
async function actualiser() {
  try { await chargerStructure(); await chargerDonnees(); }
  catch (e) { message('Lecture du document impossible : ' + e.message, true); return; }
  etat.droits = null; etat.pages = null; etat.versions = null;
  afficher();
}

/** Paramètres de l'application sous la forme { Cle: Valeur } (vide si la table Parametres n'existe pas). */
const parametres = () => Object.fromEntries((etat.d.Gouv_Parametres || []).map((r) => [r.Cle, r.Valeur]));

// --- 12. Affichage et événements -----------------------------------------------------------------

/**
 * Vues de l'administration et module de la console qui les affiche. Chaque module enregistre sa
 * vue en se chargeant (VUES.droits = ongletDroits…) ; la Maintenance réunit Structure et Paramètres.
 */
const VUES = {};
const MODULE_DE = { accueil: 'tableau', utilisateurs: 'utilisateurs', droits: 'droits', support: 'support',
  structure: 'maintenance', parametres: 'maintenance', aide: 'aide' };

/** Redessine la vue courante dans la zone de son module ; pour les droits, calcule aussi l'aperçu des règles. */
function afficher() {
  const vue = VUES[etat.onglet];
  if (!vue) return;
  Console.zone(MODULE_DE[etat.onglet]).innerHTML = '<div class="admin">' + vue() + '</div>';
  if (etat.onglet === 'droits') majApercu();
}

/** Ouvre une autre vue (lien « Corriger → » du tableau de bord…), ou un autre module de la console. */
function allerA(onglet) { Console.ouvrir(MODULE_DE[onglet] || onglet); }

/** Module qui porte chaque action des boutons (data-action), chargé au besoin avant de l'exécuter. */
const MODULE_DE_L_ACTION = {
  'export-csv': 'utilisateurs', ajouter: 'utilisateurs', 'g-activer': 'utilisateurs', 'g-desactiver': 'utilisateurs', 'ajouter-role': 'utilisateurs',
  standard: 'droits', vider: 'droits', 'appliquer-droits': 'droits', 'retirer-droits': 'droits', garde: 'droits',
  repondre: 'support', 'repondre-clore': 'support', clore: 'support', rouvrir: 'support',
  installer: 'maintenance', publier: 'maintenance', versions: 'maintenance', pages: 'maintenance', 'page-installer': 'maintenance', module: 'maintenance',
};

/**
 * Déclare la vue d'un module de la console : à chaque affichage du module, la vue devient
 * courante et se redessine (une fois les données lues).
 * @param {string} module  clé du module dans la console
 * @param {string} onglet  vue de l'administration qu'il affiche
 */
function declarerVue(module, onglet) {
  Console.quandAffiche(module, () => { etat.onglet = onglet; pret.then(afficher); });
}

/**
 * Enregistre aussitôt une valeur modifiée dans un tableau. L'élément désigne sa cible par ses
 * attributs : data-u (utilisateur), data-t (demande de support) ou data-p (paramètre), et data-col.
 * Les changements de rôle, d'entité ou d'activité d'un utilisateur sont tracés au journal.
 * @param {HTMLElement} el  champ, liste ou case modifié
 */
async function enregistrerChamp(el) {
  const val = el.type === 'checkbox' ? el.checked : el.dataset.type === 'ref' ? (Number(el.value) || 0) : el.value;
  try {
    if (el.dataset.u) {
      await agir([['UpdateRecord', 'Gouv_Utilisateurs', Number(el.dataset.u), { [el.dataset.col]: val }]]);
      const u = etat.d.Gouv_Utilisateurs.find((x) => x.id === Number(el.dataset.u)); u[el.dataset.col] = val;
      if (el.dataset.col !== 'Nom') tracer('Utilisateur modifié', u.Courriel + ' : ' + el.dataset.col + ' = ' + (el.dataset.type === 'ref' ? nomEntite(val) : val));
    } else if (el.dataset.t) {
      await agir([['UpdateRecord', 'Gouv_Support', Number(el.dataset.t), { [el.dataset.col]: val }]]);
    } else if (el.dataset.p) {
      await agir([['UpdateRecord', 'Gouv_Parametres', Number(el.dataset.p), { Valeur: val }]]);
      etat.d.Gouv_Parametres.find((x) => x.id === Number(el.dataset.p)).Valeur = val;
    }
    message('✅ Enregistré.');
  } catch (e) { message('❌ ' + esc(e.message), true); }
}

// Changement d'une valeur (liste, case, champ quitté) : enregistrement direct, filtres, sélection,
// matrice des droits. La matrice n'est pas écrite ici : seul l'aperçu est mis à jour.
document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset.u || el.dataset.t || el.dataset.p) return enregistrerChamp(el);
  if (el.id === 'u-role') { etat.filtres.role = el.value; return afficher(); }
  if (el.id === 'u-statut') { etat.filtres.statut = el.value; return afficher(); }
  if (el.dataset.sel) { el.checked ? etat.selection.add(Number(el.dataset.sel)) : etat.selection.delete(Number(el.dataset.sel)); return afficher(); }
  if (el.id === 'u-tous') { utilisateursFiltres().forEach((u) => (el.checked ? etat.selection.add(u.id) : etat.selection.delete(u.id))); return afficher(); }
  if (el.id === 'g-role' && el.value) return groupe({ Role: el.value }, 'Rôle « ' + el.value + ' »');
  if (el.dataset.matTable) { const t = el.dataset.matTable; (etat.droits.niveaux[t] = etat.droits.niveaux[t] || {})[el.dataset.matRole] = el.value; return majApercu(); }
  if (el.id === 'bloquer-autres') { etat.droits.bloquerAutres = el.checked; return majApercu(); }
  if (el.id === 'support-prive') { etat.droits.supportPrive = el.checked; return majApercu(); }
});

// Recherche à la frappe, en gardant le curseur dans le champ.
document.addEventListener('input', (e) => {
  if (e.target.id !== 'u-recherche') return;
  etat.filtres.texte = e.target.value;
  const pos = e.target.selectionStart; afficher();
  const champ = $('u-recherche'); champ.focus(); champ.setSelectionRange(pos, pos);
});

/**
 * Applique la même modification à tous les utilisateurs cochés, en une transaction, puis vide la sélection.
 * @param {object} champs   colonnes à modifier, ex. { Actif: false }
 * @param {string} libelle  texte pour le journal
 */
async function groupe(champs, libelle) {
  const ids = [...etat.selection]; if (!ids.length) return;
  await occupe(null, async () => {
    await agir([['BulkUpdateRecord', 'Gouv_Utilisateurs', ids, Object.fromEntries(Object.entries(champs).map(([k, v]) => [k, ids.map(() => v)]))]]);
    await tracer('Modification groupée', ids.length + ' personne(s) : ' + libelle);
    message('✅ ' + ids.length + ' personne(s) mise(s) à jour.');
    etat.selection.clear(); await actualiser();
  });
}

// Ctrl+Entrée envoie la réponse en cours de saisie.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.id?.startsWith('rep-')) {
    document.querySelector(`[data-action="repondre"][data-id="${e.target.id.slice(4)}"]`)?.click();
  }
});

// Clics sur les boutons : changement d'onglet, filtre du support, choix d'une demande, puis
// actions désignées par data-action (un « case » par bouton de la page).
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.onglet) return allerA(b.dataset.onglet);
  if (b.dataset.ongletAller) return allerA(b.dataset.ongletAller);
  if (b.dataset.support) { etat.filtres.support = b.dataset.support; return afficher(); }
  if (b.dataset.ticket) { etat.ticket = Number(b.dataset.ticket); return afficher(); }
  const id = Number(b.dataset.id);
  // une action peut venir d'un autre module (ex. « Corriger » du tableau de bord) : on charge son module d'abord
  const proprietaire = MODULE_DE_L_ACTION[b.dataset.action];
  if (proprietaire) await Console.charger(proprietaire);
  switch (b.dataset.action) {
    case 'actualiser': etat.sujets = null; return actualiser();
    case 'export-csv': return exporterCsv();
    case 'ajouter': return ajouterPersonnes(b);
    case 'g-activer': return groupe({ Actif: true }, 'activées');
    case 'g-desactiver': return groupe({ Actif: false }, 'désactivées');
    case 'ajouter-role': {
      const r = $('nouveau-role').value.trim(); if (!r || roles().includes(r)) return;
      const c = colonne('Gouv_Utilisateurs', 'Role'); const wo = json(c.widgetOptions, {}); wo.choices = [...(wo.choices || []), r];
      return occupe(b, async () => { await agir([['ModifyColumn', 'Gouv_Utilisateurs', 'Role', { widgetOptions: JSON.stringify(wo) }]]); await tracer('Rôle ajouté', r); await actualiser(); });
    }
    case 'standard': etat.droits = matriceStandard(); return afficher();
    case 'vider': etat.droits = { niveaux: {}, bloquerAutres: false, supportPrive: false }; return afficher();
    case 'appliquer-droits': return appliquerDroits(b, false);
    case 'retirer-droits': return appliquerDroits(b, true);
    case 'garde': return poserGarde(b);
    case 'repondre': { const texte = $('rep-' + id).value.trim(); return texte && traiterTicket(b, id, { texte }); }
    case 'repondre-clore': return traiterTicket(b, id, { texte: $('rep-' + id).value.trim(), statut: 'Résolu', evenement: '✅ Demande close' });
    case 'clore': return traiterTicket(b, id, { statut: 'Résolu', evenement: '✅ Demande close' });
    case 'rouvrir': return traiterTicket(b, id, { statut: 'En cours', evenement: '↩️ Demande rouverte' });
    case 'installer': return installerSujet(b, b.dataset.sujet);
    case 'publier': return publierNorme(b);
    case 'versions': return mettreAJourPages(b);
    case 'pages': return creerPages(b);
    case 'page-installer': return creerPages(b, [b.dataset.valeur]);
    case 'module': return installerModule(b, b.dataset.sujet);
  }
});

// --- Fonctions partagées par plusieurs modules ----------------------------------------------
// (dépôt de la norme, liste de choix, demandes ouvertes, ressources des règles d'accès)

/**
 * Dépôt de la norme à utiliser : un GitLab si Parametres le configure (Gitlab_API et Gitlab_projet),
 * sinon le dépôt public GitHub. Donne aussi le jeton éventuel, nécessaire pour publier.
 * @returns {{gitlab: boolean, api?: string, jeton?: string, branche?: string}}
 */
function depot() {
  const p = parametres();
  return p.Gitlab_API && p.Gitlab_projet
    ? { gitlab: true, api: p.Gitlab_API.replace(/\/$/, '') + '/projects/' + encodeURIComponent(p.Gitlab_projet), jeton: p.Gitlab_jeton, branche: p.Gitlab_branche || 'main' }
    : { gitlab: false, jeton: p.Github_jeton };
}

/**
 * Lit un fichier JSON du dépôt, sans cache (toujours la version la plus récente).
 * @param {string} chemin  chemin dans le dépôt, ex. « structure/support.json »
 * @returns {Promise<object>}
 * @throws si le fichier est introuvable ou le dépôt injoignable
 */
async function lireDepot(chemin) {
  const d = depot();
  const url = d.gitlab ? `${d.api}/repository/files/${encodeURIComponent(chemin)}/raw?ref=${d.branche}` : DEPOT + chemin;
  const r = await fetch(url, { cache: 'no-store', headers: d.gitlab && d.jeton ? { 'PRIVATE-TOKEN': d.jeton } : {} });
  if (!r.ok) throw new Error('Dépôt : ' + chemin + ' introuvable (' + r.status + ')');
  return r.json();
}

/**
 * Lit chaque sujet sur le dépôt et le compare au document ; résultat dans etat.sujets.
 * État : « present », « partiel » (colonnes manquantes ou dans le désordre), « absent »,
 * ou « inconnu » si le dépôt est injoignable. Note aussi les colonnes propres au document (« ajouts »).
 */
async function chargerSujets() {
  const res = {};
  await Promise.all(SUJETS.map(async (s) => {
    try {
      const def = await lireDepot('structure/' + s.fichier + '.json');
      const manques = [], ajouts = [];
      for (const t of def.tables) for (const c of t.columns) if (!colonne(t.tableId, c.id)) manques.push(t.tableId + '.' + c.id);
      // Colonnes du document absentes de la norme : à publier si ce document est la source.
      // (pas pour une table « extension » : ses autres colonnes appartiennent au sujet principal)
      for (const t of def.tables.filter((u) => !u.extension)) for (const c of (etat.meta.parId[t.tableId]?.colonnes || [])) if (!t.columns.some((x) => x.id === c.colId)) ajouts.push(t.tableId + '.' + c.colId);
      // Absent : aucune de ses tables propres (une table « extension », comme Entites pour Territoires, appartient au socle)
      const propres = def.tables.filter((t) => !t.extension);
      const absent = (propres.length ? propres : def.tables).every((t) => !aTable(t.tableId));
      // Hors document source : colonnes présentes mais pas dans l'ordre de la norme.
      const desordre = !estSource() && def.tables.some((t) => {
        const ici = (etat.meta.parId[t.tableId]?.colonnes || []).map((c) => c.colId).filter((id) => t.columns.some((x) => x.id === id));
        return ici.join() !== t.columns.map((c) => c.id).filter((id) => ici.includes(id)).join();
      });
      res[s.fichier] = { def, manques, ajouts, desordre, etat: absent ? 'absent' : manques.length || desordre ? 'partiel' : 'present' };
    } catch (e) { res[s.fichier] = { erreur: true, etat: 'inconnu' }; }
  }));
  etat.sujets = res;
}

// ticketOuvert : règle commune à tous les widgets (commun/outils.js), utilisée par le tableau de bord et le support.
const ticketOuvert = (t) => Outils.ticketOuvert(t);

const options = (valeurs, choisie, vide = '—') => `<option value="">${vide}</option>` + valeurs.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(choisie) ? ' selected' : ''}>${esc(l)}</option>`).join('');

// ressource : cible d'une règle (table et colonnes visées) ; reglesDuPanneau : règles portant la mention [Admin].
const ressource = (id) => etat.acl.ressources.find((r) => r.id === id);

/** Règles d'accès écrites par le panneau des droits (mention [Admin]) ; lues aussi par le tableau de bord. */
const reglesDuPanneau = () => (etat.acl.regles || []).filter((r) => String(r.memo || '').startsWith(MARQUE));

// --- Démarrage -------------------------------------------------------------------------------------

// Style propre à l'administration (matrice des droits, fiches du support…), chargé avec la version de la page
(() => {
  const v = new URLSearchParams(location.search).get('v');
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'admin/gestion.css' + (v ? '?v=' + v : '');
  document.head.appendChild(l);
})();
// Grist prévient quand les lignes de la table liée changent : on se remet à jour (400 ms : un seul
// rechargement pour plusieurs changements rapprochés).
let minuterie = null;
grist.onRecords(() => { clearTimeout(minuterie); minuterie = setTimeout(actualiser, 400); });
// Première lecture, puis celle du dépôt de la norme (plus lente) pour compléter tableau de bord et maintenance.
const pret = actualiser();
pret.then(() => chargerSujets().then(() => { if (etat.onglet === 'accueil' || etat.onglet === 'structure') afficher(); }));
