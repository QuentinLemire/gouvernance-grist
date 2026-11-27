/**
 * =====================================================================
 *  Installateur du socle « Gouvernance des données » dans un document Grist
 * =====================================================================
 *
 *  À quoi ça sert
 *  --------------
 *  Recrée dans n'importe quel document Grist les tables standard de la norme
 *  DGOM, décrites dans le dossier `structure/` de ce dépôt (utilisateurs,
 *  référentiel des territoires, paramètres, page d'accueil publique, support,
 *  journal, documentation), puis pose les règles d'accès de base.
 *  C'est l'équivalent « en ligne de commande » du bouton « Installer » de
 *  l'onglet Structure du widget Administration.
 *
 *  Ce que le script lit : le format « grist-structure »
 *  ----------------------------------------------------
 *  Chaque fichier `structure/<sujet>.json` décrit un « sujet » (un ensemble
 *  cohérent de tables), sans aucune donnée :
 *      {
 *        "format": "grist-structure", "version": "1.5", "sujet": "SUPPORT",
 *        "tables": [ { "tableId": "Gouv_Support", "columns": [
 *            { "id": "Titre", "label": "Titre", "type": "Text" },
 *            { "id": "Personne", "type": "Ref:Gouv_Utilisateurs", "isFormula": true,
 *              "formula": "Gouv_Utilisateurs.lookupOne(…)", "visibleCol": "Courriel" }, … ] } ],
 *        "dependances": [ "UTILISATEURS" ]
 *      }
 *  - L'ORDRE des colonnes dans le fichier est l'ordre de la norme : ce qui
 *    identifie la ligne d'abord, puis le contenu, les liens, l'état, et la
 *    traçabilité (CreeLe, CreePar…) en dernier.
 *  - « visibleCol » indique quelle colonne afficher pour une référence
 *    (ex. le courriel de la personne plutôt que son numéro de ligne).
 *  - « dependances » liste les sujets à installer avant celui-ci
 *    (le support a besoin de l'annuaire des utilisateurs).
 *
 *  Comment l'utiliser
 *  ------------------
 *  1. Ouvrir le document Grist cible (en étant PROPRIÉTAIRE).
 *  2. Ouvrir la console du navigateur (F12 → Console).
 *  3. Coller tout ce fichier, valider, puis lancer par exemple :
 *        await installerGouvernance(['utilisateurs', 'parametres', 'accueil_public', 'support', 'journal', 'documentation'])
 *  4. Un tableau récapitulatif s'affiche dans la console : tables créées,
 *     colonnes ajoutées, données de référence chargées, règles d'accès.
 *
 *  Principes de sécurité
 *  ---------------------
 *  - Rien n'est supprimé : le script ajoute seulement les tables et les
 *    colonnes qui manquent, et range les colonnes dans l'ordre de la norme.
 *    Une colonne déjà présente n'est jamais modifiée, les données ne sont
 *    jamais effacées, et les colonnes propres à l'application sont conservées
 *    (placées après celles de la norme). On peut donc le relancer sans risque.
 *  - Il passe par l'API REST de Grist avec la session de l'utilisateur
 *    connecté (aucune clé d'API à saisir).
 *  - Les règles d'accès qu'il écrit portent la mention « [Gouvernance] »
 *    pour être reconnaissables dans « Permissions avancées ».
 */

// ===== 1. Réglages =====

// Adresse publique du dépôt, d'où sont téléchargés les fichiers structure/*.json
// (servis par jsDelivr depuis GitHub, branche main = dernière
// version de la norme). Pour installer une version figée, passer une adresse
// pointant sur un commit précis via l'option { depot } d'installerGouvernance.
const DEPOT_PAR_DEFAUT = 'https://cdn.jsdelivr.net/gh/QuentinLemire/gouvernance-grist@main/';

// Document visé : par défaut celui qui est ouvert dans l'onglet ;
// installerGouvernance(…, { docId }) permet d'en viser un autre.
let DOC_CIBLE = null;


// ===== 2. Accès à l'API Grist du document =====
// Petites fonctions qui envoient les demandes au serveur Grist. Toutes passent
// par la session du navigateur : on agit avec les droits de la personne connectée.

/**
 * Retrouve l'identifiant du document ouvert dans l'adresse de la page
 * (…/o/<organisation>/<docId>/…).
 * @returns {string} l'identifiant du document
 * @throws si l'adresse ne contient pas d'identifiant (page qui n'est pas un document)
 */
function docIdCourant() {
  const m = location.pathname.match(/\/(?:o\/[^/]+\/)?([A-Za-z0-9]{12,})(?:\/|$)/);
  if (!m) throw new Error("Impossible de trouver l'identifiant du document dans l'adresse.");
  return m[1];
}

/**
 * Appelle l'API REST du document visé et renvoie la réponse JSON.
 * En cas de refus du serveur (droits insuffisants, table inconnue…), lève une
 * erreur qui reprend le chemin appelé et le message de Grist, pour savoir
 * précisément ce qui a échoué.
 * @param {string} chemin   fin de l'adresse, ex. '/tables' ou '/apply'
 * @param {Object} options  options de fetch (méthode, corps…) ; GET par défaut
 * @returns {Promise<Object>} la réponse de Grist
 */
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

/**
 * Envoie une liste d'actions Grist (« user actions » : AddTable, AddColumn,
 * BulkUpdateRecord…) en une seule transaction : soit tout passe, soit rien.
 * Ce sont les mêmes actions que celles que Grist enregistre quand on modifie
 * le document à la main ; elles apparaissent donc dans l'historique.
 * @param {Array[]} actions  liste d'actions, ex. [['AddColumn', 'Gouv_Support', 'Titre', {…}]]
 * @returns {Promise<Object>} réponse de Grist (retValues : identifiants créés)
 */
const appliquer = (actions) => api('/apply', { method: 'POST', body: JSON.stringify(actions) });

/**
 * Exécute une requête SQL en LECTURE sur le document. Elle donne accès aux
 * tables techniques de Grist (_grist_Tables, _grist_Tables_column,
 * _grist_ACLRules…), où sont rangés la position des colonnes, les vues et les
 * règles d'accès, informations que l'API REST classique ne fournit pas.
 * @param {string} requete  requête SELECT
 * @returns {Promise<Object[]>} une liste d'objets, un par ligne de résultat
 */
const sql = async (requete) =>
  (await api('/sql?q=' + encodeURIComponent(requete))).records.map((r) => r.fields);

// ===== 3. Création de la structure =====
// Traduit les fichiers structure/*.json en tables et colonnes Grist, règle
// l'affichage des références, puis range les colonnes dans l'ordre de la norme.

/**
 * Convertit une colonne du format grist-structure vers la description attendue
 * par Grist dans les actions AddTable / AddColumn.
 * Valeurs par défaut : libellé = identifiant, type « Any », colonne de données
 * (pas une formule). Les options d'affichage (choix d'une liste, couleurs…)
 * sont transmises telles quelles, converties en texte comme Grist le demande.
 * @param {Object} c  colonne lue dans structure/*.json
 * @returns {Object} propriétés de la colonne pour Grist
 */
function versColonneGrist(c) {
  return {
    label: c.label || c.id,
    type: c.type || 'Any',
    isFormula: !!c.isFormula,
    formula: c.formula || '',
    recalcWhen: c.recalcWhen || 0,       // 0 = à la création, 2 = à chaque modification
    widgetOptions: c.widgetOptions ? JSON.stringify(c.widgetOptions) : '',
    // l'identifiant ne suit pas le libellé : corriger un libellé dans Grist ne renomme pas la colonne
    untieColIdFromLabel: true,
  };
}

/**
 * Donne la table vers laquelle pointe une colonne de référence :
 * « Ref:Gouv_Entites » ou « RefList:Gouv_Entites » → « Entites ». Pour toute autre
 * colonne, renvoie null.
 * @param {Object} c  colonne au format grist-structure
 * @returns {string|null}
 */
const tableReferencee = (c) => (/^(Ref|RefList):(\w+)/.exec(c.type || '') || [])[2] || null;

/**
 * Ajoute au document les tables et colonnes de la norme qui manquent.
 *
 * Rien n'est supprimé ni modifié : une table existante est complétée, une
 * colonne déjà présente (même identifiant) est laissée telle quelle.
 *
 * Pourquoi deux passes ? Une colonne peut dépendre d'une autre table (une
 * référence « Ref:Gouv_Utilisateurs », ou une formule qui cite « Utilisateurs. »).
 * Grist refuse de la créer si cette table n'existe pas encore. Ces colonnes
 * sont donc mises de côté, puis ajoutées à la fin, une fois toutes les tables
 * présentes ; l'ordre des sujets demandés n'a ainsi pas d'importance.
 *
 * Ensuite : réglage de la colonne affichée des références, puis rangement
 * des colonnes dans l'ordre de la norme.
 *
 * @param {Object[]} tables  tables des sujets à installer ({ tableId, columns })
 * @returns {Promise<{tables: string[], colonnes: string[]}>} ce qui a été créé
 * Actions Grist envoyées : AddTable, AddColumn (puis celles des deux fonctions suivantes).
 */
async function creerStructure(tables) {
  const existantes = new Set((await api('/tables')).tables.map((t) => t.id));
  const toutes = new Set([...existantes, ...tables.map((t) => t.tableId)]);
  const enAttente = [];
  const rapport = { tables: [], colonnes: [] };

  // Une colonne « dépend » d'une table si elle la référence ou la cite dans sa formule
  // (on cherche « NomDeTable. » dans le texte de la formule).
  const dependances = (c) => {
    const deps = [tableReferencee(c)];
    for (const t of toutes) if (new RegExp(`\\b${t}\\.`).test(c.formula || '')) deps.push(t);
    return deps.filter(Boolean);
  };

  // Première passe : pour chaque table, on ajoute tout de suite les colonnes
  // « prêtes » ; les autres attendent la seconde passe.
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
      // AddTable ignore le réglage de recalcul : on le repose colonne par colonne (sinon ModifieLe / ModifiePar
      // ne seraient remplis qu'à la création de la ligne).
      const aRecalculer = maintenant.filter(([, c]) => !c.isFormula && c.formula && c.recalcWhen);
      if (aRecalculer.length) await appliquer(aRecalculer.map(([t, c]) => ['ModifyColumn', t, c.id, { recalcWhen: c.recalcWhen }]));
      existantes.add(table.tableId);
      rapport.tables.push(table.tableId);
    } else if (maintenant.length) {
      await appliquer(maintenant.map(([t, c]) => ['AddColumn', t, c.id, versColonneGrist(c)]));
    }
    rapport.colonnes.push(...maintenant.map(([t, c]) => `${t}.${c.id}`));
  }

  // Seconde passe : colonnes différées (toutes les tables existent désormais).
  for (const [t, c] of enAttente) {
    await appliquer([['AddColumn', t, c.id, versColonneGrist(c)]]);
    rapport.colonnes.push(`${t}.${c.id}`);
  }

  await reglerAffichageDesReferences(tables);
  await rangerColonnes(tables);
  return rapport;
}

/** Sujets du socle (les autres sont des modules à installer au besoin). */
const SOCLE = ['utilisateurs', 'parametres', 'accueil_public'];

/**
 * Repère les tables de la norme dans « Données source » : 🧱 devant une table du socle, 🧩 devant
 * une table de module ; les tables propres à l'application ne sont pas touchées.
 * Le titre reprend le nom exact de la table : Grist recalcule l'identifiant d'après le titre, et
 * « 🧱 Utilisateurs » redonne bien Utilisateurs (un autre titre renommerait la table et casserait
 * formules, règles et widgets).
 * @param {Map<string, Object>} sujets  sujets installés (nom du fichier → contenu)
 */
async function etiqueterTables(sujets) {
  const tables = await sql('select t.tableId, s.id as section, s.title from _grist_Tables t join _grist_Views_section s on s.id = t.rawViewSectionRef');
  const actions = [];
  for (const [nom, def] of sujets) {
    for (const t of def.tables.filter((u) => !u.extension)) {
      const ici = tables.find((x) => x.tableId === t.tableId);
      const titre = (SOCLE.includes(nom) ? '🧱 ' : '🧩 ') + t.tableId;
      if (ici && ici.title !== titre) actions.push(['UpdateRecord', '_grist_Views_section', ici.section, { title: titre }]);
    }
  }
  if (actions.length) await appliquer(actions);
}

/**
 * Range les colonnes dans l'ordre de la norme (celui des fichiers structure/*.json).
 *
 * Les colonnes de la norme passent en premier, dans l'ordre prévu ; les
 * colonnes propres à l'application les suivent, en gardant leur ordre actuel
 * (tri « stable »). Aucune colonne n'est supprimée ni masquée.
 * L'ordre est appliqué à trois endroits : la structure de la table, la vue
 * « données brutes » et la fiche (« record card ») de chaque table. Les pages
 * créées par l'application gardent leur propre disposition.
 *
 * @param {Object[]} tables  tables de la norme ({ tableId, columns })
 * Actions Grist envoyées : BulkUpdateRecord sur _grist_Tables_column et
 * _grist_Views_section_field (champ parentPos = position).
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
    // Ordre : colonnes de la norme, puis colonnes propres à l'application, et la traçabilité toujours en dernier (P4).
    const trace = ['CreeLe', 'CreePar', 'ModifieLe', 'ModifiePar'];
    // Table « extension » (colonnes ajoutées par un autre sujet, ex. Entites.Territoire) : on ne reclasse que la traçabilité.
    const norme = table.extension ? [] : table.columns.map((c) => c.id).filter((id) => !trace.includes(id));
    const rang = (colId) => (trace.includes(colId) ? norme.length + 1 + trace.indexOf(colId)
      : norme.includes(colId) ? norme.indexOf(colId) : norme.length);
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

/**
 * Règle l'affichage des colonnes de référence.
 * Sans réglage, Grist affiche le numéro de la ligne pointée (« Utilisateurs[12] »),
 * illisible pour un agent. Le champ « visibleCol » du fichier de structure dit
 * quelle colonne montrer à la place (ex. le Nom de l'entité, le courriel de la
 * personne). C'est l'équivalent du réglage « Afficher la colonne » de Grist.
 * Les colonnes sans visibleCol, ou dont la table cible est absente, sont ignorées.
 *
 * @param {Object[]} tables  tables de la norme ({ tableId, columns })
 * Actions Grist envoyées : ModifyColumn (visibleCol) et SetDisplayFormula
 * (formule d'affichage « $Colonne.ColonneVisible »).
 */
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

// ===== 4. Règles d'accès de base =====
// Socle de droits commun à toutes les applications : le rôle d'une personne
// vient de sa fiche dans la table Utilisateurs.

/**
 * Pose les règles d'accès de base (« Permissions avancées » de Grist) :
 * - Attribut utilisateur « Profil » = la ligne de Utilisateurs dont Courriel_cle
 *   correspond au courriel de connexion. Les autres règles et les widgets
 *   s'en servent (user.Profil.Actif, rôle…).
 * - Les propriétaires gardent tous les droits.
 * - La table Accueil est lisible par tous, modifiable par les propriétaires.
 * - Une personne non inscrite (ou dont la fiche est inactive) ne voit que la
 *   table Accueil, pas même la documentation.
 *
 * Les règles sont numérotées (rulePos) car Grist les applique dans l'ordre :
 * la première qui s'applique l'emporte. Chacune porte « [Gouvernance] » dans
 * sa description pour être reconnue.
 *
 * Ne fait rien si des règles « [Gouvernance] » existent déjà : on ne touche
 * jamais à des droits déjà posés, éventuellement ajustés à la main.
 *
 * @returns {Promise<string>} 'posées' ou 'déjà en place'
 * Actions Grist envoyées : AddRecord sur _grist_ACLResources (portée des règles :
 * tout le document « * », ou la table Accueil) et sur _grist_ACLRules.
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
  const accueil = await ressource('Gouv_Accueil');

  const regle = (resource, aclFormula, permissionsText, rulePos, memo, extra = {}) =>
    ['AddRecord', '_grist_ACLRules', null, { resource, aclFormula, permissionsText, rulePos, memo, ...extra }];

  await appliquer([
    regle(parDefaut, '', '', 1, '', {
      userAttributes: JSON.stringify({ name: 'Profil', tableId: 'Gouv_Utilisateurs', charId: 'Email', lookupColId: 'Courriel_cle' }),
    }),
    regle(accueil, 'user.Access == OWNER', 'all', 2, "[Gouvernance] Propriétaires : modifier la page d'accueil"),
    regle(accueil, 'True', '+R-CUD', 3, '[Gouvernance] Accueil lisible par tous'),
    regle(parDefaut, 'user.Access == OWNER', 'all', 4, '[Gouvernance] Propriétaires : tous les droits'),
    regle(parDefaut, 'not user.Profil or not user.Profil.Actif', 'none', 5, '[Gouvernance] Non inscrits ou inactifs : Accueil seulement'),
  ]);
  return 'posées';
}

// ===== 6. Point d'entrée =====

/**
 * Installe les sujets demandés : c'est la seule fonction à appeler.
 *
 * Déroulé :
 *   1. télécharge structure/<sujet>.json pour chaque sujet, et de proche en
 *      proche ses dépendances (champ « dependances ») ;
 *   2. crée les tables et colonnes manquantes, règle l'affichage des
 *      références et range les colonnes (rien n'est supprimé) ;
 *   3. charge les données de référence dans les tables encore vides ;
 *   4. pose les règles d'accès de base si l'annuaire (utilisateurs) et la
 *      page d'accueil (accueil_public) font partie de l'installation.
 *
 * @param {string[]} sujets   noms des fichiers de structure/, sans « .json »
 * @param {Object}   [options]
 * @param {string}   [options.docId]  autre document à viser (par défaut : celui ouvert)
 * @param {string}   [options.depot]  autre adresse du dépôt (par défaut : DEPOT_PAR_DEFAUT)
 * @returns {Promise<Object>} rapport { tables, colonnes, regles },
 *          également affiché sous forme de tableau dans la console
 *
 * Exemples :
 *   await installerGouvernance(['utilisateurs', 'support'])
 *   await installerGouvernance(['documentation'], { docId: 'abc123…' })   // un autre document
 */
async function installerGouvernance(sujets, { docId = null, depot = DEPOT_PAR_DEFAUT } = {}) {
  DOC_CIBLE = docId;

  // 1. Lire les sujets demandés et, de proche en proche, leurs dépendances.
  //    Les dépendances sont écrites en majuscules dans les fichiers (« UTILISATEURS ») :
  //    on les met en minuscules pour retrouver le nom du fichier. Un sujet déjà lu
  //    n'est pas relu, ce qui évite les doublons.
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

  // 2. Créer toutes les tables en une passe : les tables de tous les sujets sont
  //    traitées ensemble, les références croisées se règlent à la fin.
  const tables = [...lus.values()].flatMap((def) => def.tables);
  const rapport = await creerStructure(tables);

  // La norme installe la structure seulement, jamais de données (décision du 27/11/2026).

  // 3 bis. Repérage des tables de la norme dans « Données source » : 🧱 socle, 🧩 module.
  await etiqueterTables(lus);

  // 4. Règles d'accès : elles n'ont de sens que si l'annuaire (Utilisateurs, qui
  //    fournit le Profil) et la page d'accueil (seule table visible des non-inscrits)
  //    sont présents.
  if (lus.has('utilisateurs') && lus.has('accueil_public')) {
    rapport.regles = await poserReglesDeBase();
  }
  console.table(rapport);
  return rapport;
}
