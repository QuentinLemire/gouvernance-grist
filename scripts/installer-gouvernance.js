/**
 * =====================================================================
 *  Installateur du socle « Gouvernance des données » dans un document Grist
 * =====================================================================
 *
 *  À quoi ça sert
 *  --------------
 *  Recrée dans n'importe quel document Grist les sujets transverses définis
 *  dans le dossier `structure/` de ce dépôt (utilisateurs, support, journal,
 *  paramètres, page d'accueil publique…), puis pose les règles d'accès de base.
 *
 *  Comment l'utiliser
 *  ------------------
 *  1. Ouvrir le document Grist cible (en étant PROPRIÉTAIRE).
 *  2. Ouvrir la console du navigateur (F12 → Console).
 *  3. Coller tout ce fichier, puis lancer par exemple :
 *        await installerGouvernance(['utilisateurs', 'support', 'journal', 'parametres', 'accueil_public'])
 *
 *  Principes de sécurité
 *  ---------------------
 *  - Le script n'efface JAMAIS rien : il ajoute les tables et les colonnes
 *    qui manquent et range les colonnes dans l'ordre de la norme. On peut donc
 *    le relancer sans risque.
 *  - Il passe par l'API REST de Grist avec la session de l'utilisateur
 *    connecté (aucune clé d'API à saisir).
 *  - Les règles d'accès qu'il écrit portent la mention « [Gouvernance] »
 *    pour être reconnaissables dans « Permissions avancées ».
 */

// Adresse publique du dépôt (servi par jsDelivr depuis GitHub). On peut la remplacer
// par une adresse figée sur un commit précis via l'option { depot } d'installerGouvernance.
const DEPOT_PAR_DEFAUT = 'https://cdn.jsdelivr.net/gh/QuentinLemire/gouvernance-grist@main/';

// Document visé : par défaut celui qui est ouvert ; installerGouvernance(…, { docId }) en choisit un autre.
let DOC_CIBLE = null;

// Jeux de données de référence livrés avec certains sujets (dossier donnees/ du dépôt).
const DONNEES_DE_REFERENCE = {
  referentiel_territoires: 'territoires.json',
};

// ---------------------------------------------------------------------
// Petits utilitaires d'accès à l'API Grist du document ouvert
// ---------------------------------------------------------------------

/** Identifiant du document ouvert, lu dans l'adresse de la page (…/o/<org>/<docId>/…). */
function docIdCourant() {
  const m = location.pathname.match(/\/(?:o\/[^/]+\/)?([A-Za-z0-9]{12,})(?:\/|$)/);
  if (!m) throw new Error("Impossible de trouver l'identifiant du document dans l'adresse.");
  return m[1];
}

/** Appelle l'API du document visé et renvoie la réponse JSON (lève une erreur lisible sinon). */
async function api(chemin, options = {}) {
  const r = await fetch(`/api/docs/${DOC_CIBLE || docIdCourant()}${chemin}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`${chemin} : ${JSON.stringify(json)}`);
  return json;
}

/** Applique une liste d'actions Grist (« user actions ») en une seule transaction. */
const appliquer = (actions) => api('/apply', { method: 'POST', body: JSON.stringify(actions) });

/** Exécute une requête SQL en lecture sur le document (tables techniques comprises). */
const sql = async (requete) =>
  (await api('/sql?q=' + encodeURIComponent(requete))).records.map((r) => r.fields);

// ---------------------------------------------------------------------
// Création de la structure
// ---------------------------------------------------------------------

/** Convertit une colonne du format `structure/*.json` vers le format attendu par Grist. */
function versColonneGrist(c) {
  return {
    label: c.label || c.id,
    type: c.type || 'Any',
    isFormula: !!c.isFormula,
    formula: c.formula || '',
    recalcWhen: c.recalcWhen || 0,       // 0 = à la création, 2 = à chaque modification
    widgetOptions: c.widgetOptions ? JSON.stringify(c.widgetOptions) : '',
  };
}

/** Table cible d'une colonne de référence (« Ref:Entites » → « Entites »), sinon null. */
const tableReferencee = (c) => (/^(Ref|RefList):(\w+)/.exec(c.type || '') || [])[2] || null;

/**
 * Ajoute les tables et colonnes manquantes.
 * Les colonnes qui dépendent d'une table pas encore créée (référence ou formule)
 * sont mises de côté puis ajoutées à la fin, une fois toutes les tables présentes.
 */
async function creerStructure(tables) {
  const existantes = new Set((await api('/tables')).tables.map((t) => t.id));
  const toutes = new Set([...existantes, ...tables.map((t) => t.tableId)]);
  const enAttente = [];
  const rapport = { tables: [], colonnes: [] };

  // Une colonne « dépend » d'une table si elle la référence ou la cite dans sa formule.
  const dependances = (c) => {
    const deps = [tableReferencee(c)];
    for (const t of toutes) if (new RegExp(`\\b${t}\\.`).test(c.formula || '')) deps.push(t);
    return deps.filter(Boolean);
  };

  for (const table of tables) {
    const colonnesActuelles = existantes.has(table.tableId)
      ? new Set((await api(`/tables/${table.tableId}/columns`)).columns.map((c) => c.id))
      : new Set();

    const maintenant = [];
    for (const c of table.columns) {
      if (colonnesActuelles.has(c.id)) continue;                       // déjà là : on n'y touche pas
      const pret = dependances(c).every((t) => t === table.tableId || existantes.has(t));
      (pret ? maintenant : enAttente).push([table.tableId, c]);
    }

    if (!existantes.has(table.tableId)) {
      await appliquer([['AddTable', table.tableId, maintenant.map(([, c]) => ({ id: c.id, ...versColonneGrist(c) }))]]);
      existantes.add(table.tableId);
      rapport.tables.push(table.tableId);
    } else if (maintenant.length) {
      await appliquer(maintenant.map(([t, c]) => ['AddColumn', t, c.id, versColonneGrist(c)]));
    }
    rapport.colonnes.push(...maintenant.map(([t, c]) => `${t}.${c.id}`));
  }

  // Colonnes différées (toutes les tables existent désormais).
  for (const [t, c] of enAttente) {
    await appliquer([['AddColumn', t, c.id, versColonneGrist(c)]]);
    rapport.colonnes.push(`${t}.${c.id}`);
  }

  await reglerAffichageDesReferences(tables);
  await rangerColonnes(tables);
  return rapport;
}

/**
 * Range les colonnes dans l'ordre de la norme (les colonnes propres à l'application suivent),
 * dans la structure et dans la vue « données brutes » / fiche de chaque table.
 */
async function rangerColonnes(tables) {
  const colonnes = await sql(
    'select c.id, c.colId, t.tableId, t.rawViewSectionRef, t.recordCardViewSectionRef from _grist_Tables_column c ' +
    "join _grist_Tables t on t.id = c.parentId where c.colId != 'manualSort' and c.colId not like 'gristHelper%' order by c.parentPos"
  );
  const champs = await sql('select id, parentId, colRef from _grist_Views_section_field');
  const actions = [];
  for (const table of tables) {
    const ici = colonnes.filter((c) => c.tableId === table.tableId);
    if (!ici.length) continue;
    const norme = table.columns.map((c) => c.id);
    const rang = (colId) => (norme.includes(colId) ? norme.indexOf(colId) : norme.length);
    const ordre = [...ici].sort((a, b) => rang(a.colId) - rang(b.colId)); // tri stable : le reste garde son ordre
    actions.push(['BulkUpdateRecord', '_grist_Tables_column', ordre.map((c) => c.id), { parentPos: ordre.map((_, i) => i + 1) }]);
    const position = Object.fromEntries(ordre.map((c, i) => [c.id, i]));
    for (const section of [ici[0].rawViewSectionRef, ici[0].recordCardViewSectionRef]) {
      const f = champs.filter((x) => x.parentId === section && x.colRef in position).sort((a, b) => position[a.colRef] - position[b.colRef]);
      if (f.length) actions.push(['BulkUpdateRecord', '_grist_Views_section_field', f.map((x) => x.id), { parentPos: f.map((_, i) => i + 1) }]);
    }
  }
  if (actions.length) await appliquer(actions);
}

/** Pour chaque colonne de référence, choisit la colonne affichée (ex. le Nom de l'entité plutôt que son numéro). */
async function reglerAffichageDesReferences(tables) {
  const colonnes = await sql(
    'select c.id, t.tableId, c.colId from _grist_Tables_column c join _grist_Tables t on t.id = c.parentId'
  );
  const ref = (t, c) => colonnes.find((x) => x.tableId === t && x.colId === c);
  const actions = [];
  for (const table of tables) {
    for (const c of table.columns) {
      const cible = tableReferencee(c);
      if (!cible || !c.visibleCol) continue;
      const visible = ref(cible, c.visibleCol);
      const moi = ref(table.tableId, c.id);
      if (!visible || !moi) continue;
      actions.push(['ModifyColumn', table.tableId, c.id, { visibleCol: visible.id }]);
      actions.push(['SetDisplayFormula', table.tableId, null, moi.id, `$${c.id}.${c.visibleCol}`]);
    }
  }
  if (actions.length) await appliquer(actions);
}

// ---------------------------------------------------------------------
// Règles d'accès de base
// ---------------------------------------------------------------------

/**
 * - Attribut utilisateur « Profil » = la ligne de Utilisateurs dont Email_cle = courriel de connexion.
 * - Les propriétaires gardent tous les droits.
 * - Une personne non inscrite (ou inactive) ne voit que la table Accueil.
 * Ne fait rien si des règles « [Gouvernance] » existent déjà.
 */
async function poserReglesDeBase() {
  const regles = await sql('select memo, userAttributes from _grist_ACLRules');
  if (regles.some((r) => (r.memo || '').includes('[Gouvernance]'))) return 'déjà en place';

  const ressources = await sql('select id, tableId, colIds from _grist_ACLResources');
  const ressource = async (tableId) => {
    const r = ressources.find((x) => x.tableId === tableId && x.colIds === '*');
    if (r) return r.id;
    return (await appliquer([['AddRecord', '_grist_ACLResources', null, { tableId, colIds: '*' }]])).retValues[0];
  };
  const parDefaut = await ressource('*');
  const accueil = await ressource('Accueil');

  const regle = (resource, aclFormula, permissionsText, rulePos, memo, extra = {}) =>
    ['AddRecord', '_grist_ACLRules', null, { resource, aclFormula, permissionsText, rulePos, memo, ...extra }];

  await appliquer([
    regle(parDefaut, '', '', 1, '', {
      userAttributes: JSON.stringify({ name: 'Profil', tableId: 'Utilisateurs', charId: 'Email', lookupColId: 'Email_cle' }),
    }),
    regle(accueil, 'user.Access == OWNER', 'all', 2, "[Gouvernance] Propriétaires : modifier la page d'accueil"),
    regle(accueil, 'True', '+R-CUD', 3, '[Gouvernance] Accueil lisible par tous'),
    regle(parDefaut, 'user.Access == OWNER', 'all', 4, '[Gouvernance] Propriétaires : tous les droits'),
    regle(parDefaut, 'not user.Profil or not user.Profil.Actif', 'none', 5, '[Gouvernance] Non inscrits ou inactifs : Accueil seulement'),
  ]);
  return 'posées';
}

// ---------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------

/** Remplit une table vide avec un jeu de données de référence (ne touche jamais une table déjà remplie). */
async function chargerDonnees(depot, fichier) {
  const jeu = await (await fetch(`${depot}donnees/${fichier}`)).json();
  const lignes = (await api(`/tables/${jeu.tableId}/records`)).records;
  if (lignes.length) return `${jeu.tableId} : déjà rempli`;
  await api(`/tables/${jeu.tableId}/records`, {
    method: 'POST',
    body: JSON.stringify({ records: jeu.records.map((fields) => ({ fields })) }),
  });
  return `${jeu.tableId} : ${jeu.records.length} lignes`;
}

/**
 * Installe les sujets demandés (noms des fichiers de `structure/`, sans « .json »).
 * Les sujets dont ils dépendent (champ « dependances ») sont ajoutés automatiquement.
 *
 * Exemples :
 *   await installerGouvernance(['utilisateurs', 'support'])
 *   await installerGouvernance(['documentation'], { docId: 'abc123…' })   // un autre document
 */
async function installerGouvernance(sujets, { docId = null, depot = DEPOT_PAR_DEFAUT } = {}) {
  DOC_CIBLE = docId;

  // 1. Lire les sujets demandés et, de proche en proche, leurs dépendances.
  const aLire = [...sujets];
  const lus = new Map();
  while (aLire.length) {
    const sujet = aLire.shift();
    if (lus.has(sujet)) continue;
    const r = await fetch(`${depot}structure/${sujet}.json`);
    if (!r.ok) throw new Error(`Sujet introuvable sur le dépôt : ${sujet}`);
    const def = await r.json();
    lus.set(sujet, def);
    for (const dep of def.dependances || []) aLire.push(dep.toLowerCase());
  }

  // 2. Créer toutes les tables en une passe (les références croisées se règlent à la fin).
  const tables = [...lus.values()].flatMap((def) => def.tables);
  const rapport = await creerStructure(tables);

  // 3. Données de référence (territoires…) si leur table est vide.
  rapport.donnees = [];
  for (const sujet of lus.keys()) {
    if (DONNEES_DE_REFERENCE[sujet]) rapport.donnees.push(await chargerDonnees(depot, DONNEES_DE_REFERENCE[sujet]));
  }

  // Les règles d'accès n'ont de sens que si l'annuaire et la page d'accueil sont présents.
  if (lus.has('utilisateurs') && lus.has('accueil_public')) {
    rapport.regles = await poserReglesDeBase();
  }
  console.table(rapport);
  return rapport;
}
