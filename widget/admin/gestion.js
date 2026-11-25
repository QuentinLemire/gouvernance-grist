/*
 * =====================================================================
 *  Moteur de l'administration — console d'administration (DGOM)
 * =====================================================================
 *  Partagé par les modules Rôles et droits, Support, Maintenance et
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
 * Règles placées DEVANT celles du panneau et jamais touchées par lui : garde-fous [Intégrité], et règles
 * métier [Priorité] qui ajoutent un droit à certaines personnes quel que soit leur rôle (ex. une
 * « double casquette » : un chef de bureau qui fait aussi la RH).
 */
const PRIORITAIRES = [INTEGRITE, '[Priorité]'];
const estPrioritaire = (r) => PRIORITAIRES.some((p) => String(r.memo || '').startsWith(p));

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
// module : outil affiché par console.html (page par outil, ?module=…) ; gardé quand la version change
const URL_WIDGET = (version, fichier, module) => `${SITE_WIDGETS}${fichier}?${module ? 'module=' + module + '&' : ''}v=${version}`;
// Reconnaît une adresse de widget de la norme : GitHub Pages (fichier, version) ou ancienne adresse raw.githack (version, fichier).
const ADRESSE_WIDGET = new RegExp(`(?:/${GITHUB.proprietaire}/${GITHUB.depot}/([^/]+)|${GITHUB.proprietaire}\\.github\\.io/${GITHUB.depot})/widget/([^?#]+)(?:\\?v=([0-9a-f]+))?`, 'i');

/** Sujets transverses de la norme (commun/norme.js) : fichier, nom, obligatoire (socle). */
const SUJETS = Norme.SUJETS;

/** Données de référence livrées avec certains sujets (dossier donnees/ du dépôt), chargées à l'installation si la table est vide. */
// parametres et accueil_public : valeurs de départ d'un document neuf (nom, contact, message « accès réservé »)
// documentation : une page modèle « à modifier »
const DONNEES = { parametres: 'parametres.json', accueil_public: 'accueil.json', referentiel_territoires: 'territoires.json', documentation: 'documentation.json' };

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
 * modifiable par les seuls propriétaires du document (voir planDocumentation).
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
    if (!t || t === '*' || res.colIds !== '*' || memo.startsWith(MARQUE) || memo.startsWith('[Gouvernance]') || estPrioritaire(r)) continue;
    if (!(r.aclFormula || r.permissionsText)) continue;
    m.set(t, (m.get(t) || 0) + 1);
  }
  return m;
}
/** Tables du document couvertes par la matrice des droits (hors tables à règles métier). */
const tablesGerees = () => etat.meta.tables.map((t) => t.tableId).filter((t) => !HORS_MATRICE.includes(t) && !tablesMetier().has(t));
/** Vrai si la garde est posée : une personne non inscrite, inactive ou sans rôle ne voit que l'accueil. */
const gardePresente = () => (etat.acl.regles || []).some((r) => ressource(r.resource)?.tableId === '*' && (r.aclFormula || '').includes('not ' + moi()));
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
  onglet: '',
  meta: { tables: [], parId: {}, colonnesParId: {} },  // structure du document
  d: {},                                              // données des tables utiles
  acl: { ressources: [], regles: [] },                // règles d'accès
  droits: null,                                       // matrice en cours d'édition
  filtres: { support: 'ouverts' },
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
const roles = () => choix(registre().table, 'Role');

/**
 * Registre des personnes de l'application, lu dans les règles d'accès : l'attribut utilisateur qui retrouve
 * la personne connectée par son courriel (charId « Email »). Par défaut (document neuf, Arrivées-Départs…) :
 * la table Gouv_Utilisateurs et l'attribut user.Profil. Une application existante garde le sien
 * (OPCOM : table Utilisateurs, attribut user.Permission, plusieurs rôles par personne) ; la norme s'y adapte.
 * Sans attribut déclaré : la clé Table_utilisateurs des Paramètres, sinon Gouv_Utilisateurs.
 * @returns {{table: string, attribut: string, norme: boolean, multi: boolean, actif: boolean, declare: boolean}}
 */
function registre() {
  const attributs = (etat.acl?.regles || []).map((r) => json(r.userAttributes, {})).filter((a) => a.name && a.tableId && a.charId === 'Email');
  const a = attributs.find((x) => x.tableId === 'Gouv_Utilisateurs') || attributs.find((x) => x.name === ATTRIBUT) || attributs[0];
  const parametre = (etat.d?.Gouv_Parametres || []).find((p) => p.Cle === 'Table_utilisateurs')?.Valeur;
  const table = a?.tableId || (parametre && aTable(parametre) ? parametre : 'Gouv_Utilisateurs');
  return { table, attribut: a?.name || ATTRIBUT, norme: table === 'Gouv_Utilisateurs', declare: !!a,
    multi: /^ChoiceList/.test(colonne(table, 'Role')?.type || ''), actif: !!colonne(table, 'Actif') };
}
/** Rôles d'une personne du registre : une liste (colonne Role à choix multiples), ou un seul rôle. */
const rolesDe = (u) => { const v = u?.Role; return Array.isArray(v) ? (v[0] === 'L' ? v.slice(1) : v).filter(Boolean) : v ? [v] : []; };
/** Rôle(s) qui administrent l'application : « Administrateur », ou ceux du paramètre Roles_administration. */
const rolesAdmin = () => String((etat.d?.Gouv_Parametres || []).find((p) => p.Cle === 'Roles_administration')?.Valeur || 'Administrateur')
  .split(',').map((r) => r.trim()).filter(Boolean);
/** Formules Grist sur la personne connectée, écrites pour le registre de l'application. */
const moi = () => 'user.' + registre().attribut;
/** La personne connectée a le rôle r (test seul, sans la condition « active »). */
const aLeRole = (r) => (registre().multi ? `${JSON.stringify(String(r))} in ${moi()}.Role` : `${moi()}.Role == ${JSON.stringify(String(r))}`);
/** La personne connectée a le rôle r et est active (si le registre a une colonne Actif). */
const condRole = (r) => (registre().actif ? `${moi()}.Actif and ` : '') + aLeRole(r);
/** La personne connectée est inscrite : présente, active (si la colonne existe) et avec un rôle. */
const condInscrit = () => `${moi()}` + (registre().actif ? ` and ${moi()}.Actif` : '') + ` and ${moi()}.Role`;
/** Contraire de condInscrit : absente du registre, inactive ou sans rôle. */
const condNonInscrit = () => `not ${moi()}` + (registre().actif ? ` or not ${moi()}.Actif` : '') + ` or not ${moi()}.Role`;

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
    // toutes les tables, y compris les tables de synthèse (pour repérer les règles d'accès orphelines)
    tousIds: new Set(tables.map((t) => t.tableId).filter(Boolean)),
  };
}

/**
 * Ressources des règles d'accès dont la table n'existe plus (table supprimée ou synthèse regroupée
 * autrement). Grist refuse TOUT changement de règles tant qu'il en reste (« Invalid tables in rules ») :
 * ces règles ne protègent plus rien, la norme les retire avant d'écrire (vu sur OPCOM, 25/11/2026).
 */
const ressourcesOrphelines = () => (etat.acl.ressources || [])
  .filter((r) => r.tableId && !r.tableId.startsWith('*') && !etat.meta.tousIds?.has(r.tableId));

/**
 * Charge dans etat.d les tables utiles au panneau (celles qui existent), et dans etat.acl
 * les règles d'accès. Pour une personne non propriétaire, etat.acl.regles vaut null :
 * Grist ne laisse lire les règles d'accès qu'aux propriétaires.
 */
async function chargerDonnees() {
  // les règles d'abord : elles disent quelle table est le registre des personnes (voir registre())
  etat.acl = { ressources: (await lire('_grist_ACLResources')) || [], regles: await lire('_grist_ACLRules') };
  const utiles = ['Gouv_Utilisateurs', 'Gouv_Entites', 'Gouv_Territoires', 'Gouv_Support', 'Gouv_Support_commentaires', 'Gouv_Journal', 'Gouv_Parametres'];
  etat.d = {};
  await Promise.all(utiles.filter(aTable).map(async (t) => { etat.d[t] = (await lire(t)) || []; }));
  const reg = registre().table;
  if (!etat.d[reg] && aTable(reg)) etat.d[reg] = (await lire(reg)) || [];
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
const MODULE_DE = { droits: 'droits', support: 'support',
  structure: 'maintenance', parametres: 'maintenance' };

/** Redessine la vue courante dans la zone de son module ; pour les droits, calcule aussi l'aperçu des règles. */
function afficher() {
  const vue = VUES[etat.onglet];
  if (!vue) return;
  Console.zone(MODULE_DE[etat.onglet]).innerHTML = '<div class="admin">' + vue() + '</div>';
  if (etat.onglet === 'droits') majApercu();
}

/** Ouvre une autre vue (lien « Installer → »…), ou un autre module de la console. */
function allerA(onglet) { Console.ouvrir(MODULE_DE[onglet] || onglet); }

/** Module qui porte chaque action des boutons (data-action), chargé au besoin avant de l'exécuter. */
const MODULE_DE_L_ACTION = {
  standard: 'droits', 'appliquer-droits': 'droits', 'retirer-droits': 'droits', garde: 'droits',
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
 * attributs : data-t (demande de support) ou data-p (paramètre), et data-col.
 * @param {HTMLElement} el  champ, liste ou case modifié
 */
async function enregistrerChamp(el) {
  const val = el.type === 'checkbox' ? el.checked : el.dataset.type === 'ref' ? (Number(el.value) || 0) : el.value;
  try {
    if (el.dataset.t) {
      await agir([['UpdateRecord', 'Gouv_Support', Number(el.dataset.t), { [el.dataset.col]: val }]]);
    } else if (el.dataset.p) {
      await agir([['UpdateRecord', 'Gouv_Parametres', Number(el.dataset.p), { Valeur: val }]]);
      etat.d.Gouv_Parametres.find((x) => x.id === Number(el.dataset.p)).Valeur = val;
    }
    message('✅ Enregistré.');
  } catch (e) { message('❌ ' + esc(e.message), true); }
}

// Changement d'une valeur (liste, case, champ quitté) : enregistrement direct, simulation,
// matrice des droits. La matrice n'est pas écrite ici : seul l'aperçu est mis à jour.
document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset.t || el.dataset.p) return enregistrerChamp(el);
  if (el.id === 'simu-personne') { etat.simulation = el.value; return afficher(); }
  if (el.dataset.matTable) { const t = el.dataset.matTable; (etat.droits.niveaux[t] = etat.droits.niveaux[t] || {})[el.dataset.matRole] = el.value; return majApercu(); }
  if (el.id === 'bloquer-autres') { etat.droits.bloquerAutres = el.checked; return majApercu(); }
  if (el.id === 'support-prive') { etat.droits.supportPrive = el.checked; return majApercu(); }
});

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
  // une action peut venir d'un autre module : on charge son module d'abord
  const proprietaire = MODULE_DE_L_ACTION[b.dataset.action];
  if (proprietaire) await Console.charger(proprietaire);
  switch (b.dataset.action) {
    case 'actualiser': etat.sujets = null; return actualiser();
    case 'standard': etat.droits = matriceStandard(); return afficher();
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

// ticketOuvert : règle commune à tous les widgets (commun/outils.js), utilisée par le support.
const ticketOuvert = (t) => Outils.ticketOuvert(t);

const options = (valeurs, choisie, vide = '—') => `<option value="">${vide}</option>` + valeurs.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(choisie) ? ' selected' : ''}>${esc(l)}</option>`).join('');

// ressource : cible d'une règle (table et colonnes visées) ; reglesDuPanneau : règles portant la mention [Admin].
const ressource = (id) => etat.acl.ressources.find((r) => r.id === id);

/** Règles d'accès écrites par le panneau des droits (mention [Admin]). */
const reglesDuPanneau = () => (etat.acl.regles || []).filter((r) => String(r.memo || '').startsWith(MARQUE));

/** Ce document est-il la source de la norme (Grist Gouvernance) ? Oui si Parametres.Source_norme vaut « oui ». */
const estSource = () => /^oui$/i.test(parametres().Source_norme || '');

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
// Première lecture, puis celle du dépôt de la norme (plus lente) pour compléter la maintenance.
const pret = actualiser();
pret.then(() => chargerSujets().then(() => { if (etat.onglet === 'structure') afficher(); }));
