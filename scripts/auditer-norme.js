/* =====================================================================
   AUDIT DE CONFORMITÉ À LA NORME DGOM — applications Grist
   =====================================================================

   À QUOI SERT CE SCRIPT
   ---------------------
   Il compare un document Grist à la norme décrite dans ce dépôt
   (structure/*.json et norme/principes.md) et dresse l'état des écarts,
   principe par principe (P1 à P7). Il ne fait que LIRE : aucune
   modification n'est envoyée au document.

   Le résultat est prêt à coller dans norme/applications/<application>.md
   (tableau « État par principe »).

   COMMENT L'UTILISER
   ------------------
   1. Ouvrir le document Grist à auditer (il faut au moins le droit de
      lecture ; les propriétaires voient en plus les règles d'accès).
   2. Ouvrir la console du navigateur (F12, onglet « Console »).
   3. Coller tout ce fichier, puis lancer :

        const audit = await auditerNorme();

      Le tableau de synthèse s'affiche dans la console ; le texte Markdown
      est dans audit.markdown (copy(audit.markdown) le copie directement).

   Options : auditerNorme({ docId: 'abc…', depot: 'https://…/' })
     - docId : auditer un autre document que celui ouvert ;
     - depot : lire la norme ailleurs (par défaut, la branche main sur GitHub).

   PLAN
   ----
     1. Réglages
     2. Lecture du document et de la norme
     3. Outils de comparaison
     4. Contrôles, un par principe
     5. Mise en forme du rapport
     6. Point d'entrée : auditerNorme()
   ===================================================================== */


// =====================================================================
// 1. Réglages
// =====================================================================

/** Norme lue sur GitHub (branche main) : toujours la version publiée la plus récente. */
const DEPOT_NORME = 'https://raw.githubusercontent.com/QuentinLemire/gouvernance-grist/main/';

/** Sujets de la norme, dans l'ordre d'installation. `obligatoire` = fait partie du socle (P1). */
const SUJETS_NORME = [
  { fichier: 'utilisateurs', obligatoire: true },
  { fichier: 'parametres', obligatoire: true },        // lu par la page d'accueil
  { fichier: 'accueil_public', obligatoire: true },
  { fichier: 'journal', obligatoire: true },
  { fichier: 'referentiel_territoires', obligatoire: false },   // hors socle : bouton « Installer »
  { fichier: 'support', obligatoire: false },
  { fichier: 'documentation', obligatoire: false },
];

/** Les 4 colonnes de traçabilité (P2) et le recalcul attendu : 0 = à la création, 2 = à chaque modification. */
const TRACABILITE = { CreeLe: 0, CreePar: 0, ModifieLe: 2, ModifiePar: 2 };

/** Rôles génériques de la norme (P5). Les rôles métier d'une application s'y ajoutent. */
const ROLES_GENERIQUES = ['Administrateur', 'Gestionnaire', 'Contributeur', 'Lecteur'];

/** Pages génériques qui doivent être chargées par URL depuis ce dépôt (P7). */
const WIDGETS_GENERIQUES = ['accueil.html', 'documentation.html', 'support.html', 'administration.html', 'boite-a-outils.html'];   // la Boîte à outils est facultative

/** Symboles du rapport. */
const OK = '✅', PARTIEL = '⚠️', ABSENT = '❌';


// =====================================================================
// 2. Lecture du document et de la norme
// =====================================================================

/** Identifiant du document ouvert, lu dans l'adresse de la page. */
function idDuDocument() {
  const m = location.pathname.match(/\/(?:o\/[^/]+\/)?([A-Za-z0-9]{12,})(?:\/|$)/);
  if (!m) throw new Error("Impossible de trouver l'identifiant du document dans l'adresse.");
  return m[1];
}

/**
 * Lit toutes les lignes d'une table du document (y compris les tables internes
 * _grist_…), sous forme de liste d'objets { id, …colonnes }.
 * On passe par /records plutôt que par /sql : certaines requêtes SQL sont
 * bloquées par le pare-feu de grist.numerique.gouv.fr.
 * Rend null si la table n'est pas lisible (droits) ou n'existe pas.
 */
async function lireTable(docId, table) {
  const r = await fetch(`/api/docs/${docId}/tables/${table}/records?hidden=true`, { credentials: 'include' });
  if (!r.ok) return null;
  return (await r.json()).records.map((x) => ({ id: x.id, ...x.fields }));
}

/** Lit un fichier JSON de la norme (structure/…). */
async function lireNorme(depot, chemin) {
  const r = await fetch(depot + chemin, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Norme : ${chemin} introuvable (${r.status})`);
  return r.json();
}

/**
 * Rassemble tout ce dont les contrôles ont besoin, en une fois :
 * tables et colonnes du document, pages, widgets, règles d'accès, et la norme.
 */
async function chargerTout(docId, depot) {
  const [tables, colonnes, sections, vues, regles] = await Promise.all(
    ['_grist_Tables', '_grist_Tables_column', '_grist_Views_section', '_grist_Views', '_grist_ACLRules']
      .map((t) => lireTable(docId, t)));
  const norme = await Promise.all(SUJETS_NORME.map(async (s) => ({ ...s, def: await lireNorme(depot, `structure/${s.fichier}.json`) })));

  // Index pratiques : colonnes par id, colonnes de chaque table dans l'ordre affiché.
  const colParId = new Map(colonnes.map((c) => [c.id, c]));
  const nomTable = new Map(tables.map((t) => [t.id, t.tableId]));
  const colonnesDe = new Map();
  for (const t of tables) {
    colonnesDe.set(t.tableId, colonnes
      .filter((c) => c.parentId === t.id && c.colId !== 'manualSort' && !c.colId.startsWith('gristHelper'))
      .sort((a, b) => a.parentPos - b.parentPos));
  }
  // Tables « métier » : celles de l'application, hors tables internes, tables de résumé
  // et tables techniques d'une seule colonne (ex. un « verrou » qui sert à cacher des pages).
  const metier = tables
    .filter((t) => !t.tableId.startsWith('_grist') && !t.summarySourceTable)
    .map((t) => t.tableId)
    .filter((t) => colonnesDe.get(t).length > 1);

  return { docId, tables, colonnes, sections, vues, regles, norme, colParId, nomTable, colonnesDe, metier };
}


// =====================================================================
// 3. Outils de comparaison
// =====================================================================

/**
 * Décrit une colonne du document au format des fichiers de la norme
 * (le même que le bouton « Publier la norme » du widget Administration),
 * pour pouvoir comparer les deux à l'identique.
 */
function decrire(c, colParId) {
  const o = { id: c.colId, label: c.label, type: c.type };
  if (c.isFormula) o.isFormula = true;
  if (c.formula) o.formula = c.formula;
  if (!c.isFormula && c.formula) o.recalcWhen = c.recalcWhen || 0;
  let wo = null; try { wo = JSON.parse(c.widgetOptions || 'null'); } catch (e) { /* options illisibles : ignorées */ }
  if (wo && Object.keys(wo).length) o.widgetOptions = wo;
  const vis = c.visibleCol && colParId.get(c.visibleCol);
  if (vis) o.visibleCol = vis.colId;
  return o;
}

/**
 * Empreinte comparable d'une description de colonne : clés triées, et
 * « isFormula: false » ignoré (certains fichiers l'écrivent, d'autres non).
 */
const empreinte = (o) => JSON.stringify(Object.keys(o).filter((k) => !(k === 'isFormula' && o[k] === false)).sort().map((k) => [k, o[k]]));

/**
 * Une colonne du document est-elle conforme à sa définition dans la norme ?
 * Pour une liste de choix (ex. Role), l'application peut AJOUTER des valeurs (rôles métier, P5) :
 * il suffit que tous les choix de la norme soient présents ; les couleurs ne comptent pas.
 */
function equivalente(norme, doc) {
  if (norme.type !== 'Choice' && norme.type !== 'ChoiceList') return empreinte(norme) === empreinte(doc);
  const sansOptions = (o) => { const x = { ...o }; delete x.widgetOptions; return x; };
  const choix = (o) => (o.widgetOptions && o.widgetOptions.choices) || [];
  return empreinte(sansOptions(norme)) === empreinte(sansOptions(doc)) && choix(norme).every((c) => choix(doc).includes(c));
}

/** État d'un principe à partir du nombre de points conformes sur le total. */
const etat = (bons, total) => (total === 0 || bons === total ? OK : bons === 0 ? ABSENT : PARTIEL);

/** Courte liste lisible (au plus n éléments, puis « … et N autres »). */
const liste = (l, n = 6) => (l.length <= n ? l.join(', ') : l.slice(0, n).join(', ') + ` … et ${l.length - n} autres`);


// =====================================================================
// 4. Contrôles, un par principe
//    Chaque contrôle rend des lignes { principe, objet, etat, detail }.
// =====================================================================

/** P1 — Socle : chaque table de la norme est-elle présente et complète ? */
function controlerSocle(d) {
  const lignes = [];
  for (const sujet of d.norme) {
    // Module facultatif non installé (aucune de ses tables propres) : rien à contrôler, ce n'est pas un écart.
    const propresDuSujet = sujet.def.tables.filter((t) => !t.extension);
    if (!sujet.obligatoire && propresDuSujet.every((t) => !d.colonnesDe.get(t.tableId))) continue;
    for (const t of sujet.def.tables) {
      const cols = d.colonnesDe.get(t.tableId);
      const objet = `P1 ${t.tableId}` + (t.extension ? ' (colonnes du sujet ' + sujet.fichier + ')' : '') + (sujet.obligatoire ? '' : ' (hors socle)');
      if (!cols) { lignes.push({ principe: 'P1', objet, etat: sujet.obligatoire ? ABSENT : '➖', detail: 'Table absente' }); continue; }
      const doc = new Map(cols.map((c) => [c.colId, decrire(c, d.colParId)]));
      const manquantes = t.columns.filter((c) => !doc.has(c.id)).map((c) => c.id);
      const differentes = t.columns.filter((c) => doc.has(c.id) && !equivalente(c, doc.get(c.id))).map((c) => c.id);
      // Colonnes propres à l'application : ni dans ce sujet, ni dans un autre sujet de la norme (tables partagées).
      const deLaNorme = new Set(d.norme.flatMap((x) => x.def.tables.filter((u) => u.tableId === t.tableId).flatMap((u) => u.columns.map((c) => c.id))));
      const propres = cols.map((c) => c.colId).filter((id) => !deLaNorme.has(id));
      const bons = t.columns.length - manquantes.length - differentes.length;
      const detail = [
        manquantes.length && `manquantes : ${liste(manquantes)}`,
        differentes.length && `différentes de la norme : ${liste(differentes)}`,
        propres.length && `propres à l'application : ${liste(propres)}`,
      ].filter(Boolean).join(' ; ') || 'Conforme';
      lignes.push({ principe: 'P1', objet, etat: etat(bons, t.columns.length), detail });
    }
  }
  return lignes;
}

/** P2 — Traçabilité : les 4 colonnes sur chaque table métier, avec le bon recalcul. */
function controlerTracabilite(d) {
  const sansTout = [], incompletes = [], malReglees = [];
  // Les tables du socle sans traçabilité dans la norme (Territoires, Parametres, Accueil) sont exclues.
  // (une table partagée entre sujets, comme Entites, est tracée si l'une de ses définitions l'est)
  const defs = d.norme.flatMap((s) => s.def.tables);
  const socleSansTrace = [...new Set(defs.map((t) => t.tableId))].filter((id) => !defs.some((t) => t.tableId === id && t.columns.some((c) => c.id === 'CreeLe')));
  const tables = d.metier.filter((t) => !socleSansTrace.includes(t));
  for (const t of tables) {
    const cols = new Map(d.colonnesDe.get(t).map((c) => [c.colId, c]));
    const presentes = Object.keys(TRACABILITE).filter((k) => cols.has(k));
    if (!presentes.length) { sansTout.push(t); continue; }
    if (presentes.length < 4) incompletes.push(`${t} (manque ${Object.keys(TRACABILITE).filter((k) => !cols.has(k)).join('/')})`);
    for (const k of presentes) {
      const c = cols.get(k);
      if (c.isFormula || (c.recalcWhen || 0) !== TRACABILITE[k]) malReglees.push(`${t}.${k}`);
    }
  }
  const bons = tables.length - sansTout.length - incompletes.length;
  const detail = [
    sansTout.length && `sans traçabilité : ${liste(sansTout)}`,
    incompletes.length && `incomplètes : ${liste(incompletes)}`,
    malReglees.length && `recalcul à corriger (ModifieLe/ModifiePar doivent suivre chaque modification) : ${liste(malReglees)}`,
  ].filter(Boolean).join(' ; ') || `Les ${tables.length} tables métier sont tracées`;
  return [{ principe: 'P2', objet: 'P2 Traçabilité', etat: malReglees.length && !sansTout.length && !incompletes.length ? PARTIEL : etat(bons, tables.length), detail }];
}

/**
 * P3 — Nommage : toute colonne commence par une majuscule, sans accent ni espace
 * (décision du 2026-11-23 : plus de tolérance pour les colonnes métier existantes),
 * et une adresse s'appelle « Courriel », jamais « Email » ni « Mail ».
 * Hors contrôle : colonnes techniques de Grist (manualSort, gristHelper_…, « group » des tables de résumé).
 */
function controlerNommage(d) {
  const conforme = (id) => /^[A-Z][A-Za-z0-9_]*$/.test(id);
  const anglicisme = (id) => /e?mail/i.test(id);   // Email, email_pro, Mail_groupe… → Courriel…
  const technique = (id) => id === 'manualSort' || id === 'group' || id.startsWith('gristHelper');
  const minuscules = [], courriel = [];
  for (const t of d.metier) {
    for (const c of d.colonnesDe.get(t)) {
      if (technique(c.colId)) continue;
      if (!conforme(c.colId)) minuscules.push(`${t}.${c.colId}`);
      if (anglicisme(c.colId)) courriel.push(`${t}.${c.colId}`);
    }
  }
  const detail = [
    minuscules.length && `${minuscules.length} colonne(s) sans majuscule initiale : ${liste(minuscules, 6)}`,
    courriel.length && `« Courriel » attendu à la place de : ${liste(courriel, 6)}`,
  ].filter(Boolean).join(' ; ') || 'Conforme';
  return [{ principe: 'P3', objet: 'P3 Nommage', etat: minuscules.length || courriel.length ? PARTIEL : OK, detail }];
}

/** P4 — Ordre : dans les tables de la norme, les colonnes de la norme d'abord et dans l'ordre ; la traçabilité en dernier partout. */
function controlerOrdre(d) {
  const desordre = [];
  for (const t of d.norme.flatMap((s) => s.def.tables)) {
    const cols = d.colonnesDe.get(t.tableId); if (!cols) continue;
    const attendu = t.columns.map((c) => c.id).filter((id) => cols.some((c) => c.colId === id));
    const reel = cols.map((c) => c.colId).filter((id) => attendu.includes(id));
    if (JSON.stringify(attendu) !== JSON.stringify(reel)) desordre.push(t.tableId);
  }
  const traceAilleurs = d.metier.filter((t) => {
    const ids = d.colonnesDe.get(t).map((c) => c.colId);
    const pos = Object.keys(TRACABILITE).map((k) => ids.indexOf(k)).filter((i) => i >= 0);
    return pos.length && Math.min(...pos) < ids.length - pos.length;
  });
  const detail = [
    desordre.length && `ordre différent de la norme : ${liste(desordre)}`,
    traceAilleurs.length && `traçabilité pas en dernier : ${liste(traceAilleurs)}`,
  ].filter(Boolean).join(' ; ') || 'Ordre conforme';
  return [{ principe: 'P4', objet: 'P4 Ordre des colonnes', etat: desordre.length || traceAilleurs.length ? PARTIEL : OK, detail }];
}

/** P5 — Droits : attribut user.Profil, rôles génériques, accueil seul pour les non-inscrits, formules de règles valides. */
function controlerDroits(d) {
  if (!d.regles) return [{ principe: 'P5', objet: 'P5 Droits', etat: '❔', detail: 'Règles illisibles : seul un propriétaire du document peut les auditer' }];
  const attributs = d.regles.filter((r) => r.userAttributes).map((r) => { try { return JSON.parse(r.userAttributes); } catch (e) { return {}; } });
  const profil = attributs.find((a) => a.name === 'Profil');
  const autres = attributs.filter((a) => a.name !== 'Profil').map((a) => `user.${a.name}`);
  const roleCol = (d.colonnesDe.get('Utilisateurs') || []).find((c) => c.colId === 'Role' || c.colId === 'role');
  let roles = []; try { roles = JSON.parse(roleCol?.widgetOptions || '{}').choices || []; } catch (e) { /* pas de liste */ }
  const manquants = ROLES_GENERIQUES.filter((r) => !roles.includes(r));
  const metier = roles.filter((r) => !ROLES_GENERIQUES.includes(r));
  const accueilSeul = d.regles.some((r) => /not user\.Profil/.test(r.aclFormula || ''));
  const enErreur = d.regles.filter((r) => r.aclFormula && !r.aclFormulaParsed).length;
  const points = [!!profil, !manquants.length, accueilSeul, !enErreur];
  const detail = [
    profil ? 'attribut user.Profil ✓' : `pas d'attribut user.Profil${autres.length ? ' (utilise ' + autres.join(', ') + ')' : ''}`,
    manquants.length ? `rôles génériques manquants : ${manquants.join(', ')}` : 'rôles génériques ✓',
    metier.length && `rôles métier : ${metier.join(', ')}`,
    accueilSeul ? 'non-inscrits limités à l\'accueil ✓' : 'pas de règle « non inscrits : accueil seulement »',
    `${d.regles.length} règles`,
    enErreur && `${enErreur} règle(s) dont la formule est invalide`,
  ].filter(Boolean).join(' ; ');
  return [{ principe: 'P5', objet: 'P5 Droits', etat: etat(points.filter(Boolean).length, points.length), detail }];
}

/** P6 — Un seul registre : repère les tables qui recopient presque toutes les colonnes d'une autre. */
function controlerRegistre(d) {
  const copies = [];
  const ids = (t) => new Set(d.colonnesDe.get(t).filter((c) => !c.isFormula).map((c) => c.colId).filter((id) => !(id in TRACABILITE)));
  for (let i = 0; i < d.metier.length; i++) {
    for (let j = i + 1; j < d.metier.length; j++) {
      const a = ids(d.metier[i]), b = ids(d.metier[j]);
      if (a.size < 5 || b.size < 5) continue;
      const communes = [...a].filter((x) => b.has(x)).length;
      if (communes / Math.min(a.size, b.size) >= 0.8) copies.push(`${d.metier[i]} ≈ ${d.metier[j]} (${communes} colonnes communes)`);
    }
  }
  return [{ principe: 'P6', objet: 'P6 Registre unique', etat: copies.length ? PARTIEL : OK,
    detail: copies.length ? `tables qui se recopient : ${copies.join(' ; ')}` : 'Aucune table recopiée' }];
}

/**
 * P7 — Widgets : les génériques doivent être chargés par URL depuis ce dépôt.
 * Les widgets métier peuvent rester collés dans le document (décision du 2026-11-23) :
 * ils sont seulement recensés (combien, et quelles pages partagent le même code).
 */
function controlerWidgets(d) {
  const nomVue = new Map((d.vues || []).map((v) => [v.id, v.name]));
  const colles = new Map(), urls = [];
  for (const s of d.sections || []) {
    let cv = null; try { cv = JSON.parse(JSON.parse(s.options || '{}').customView || 'null'); } catch (e) { /* pas un widget */ }
    if (!cv) continue;
    const code = cv.widgetOptions?._js;
    if (code) {
      // Widget collé dans le document (« Custom widget builder ») : on regroupe les copies d'un même code.
      const cle = code.length + ':' + code.slice(0, 200);
      colles.set(cle, [...(colles.get(cle) || []), nomVue.get(s.parentId) || `section ${s.id}`]);
    } else if (cv.url) urls.push(cv.url);
  }
  const depot = urls.filter((u) => /gouvernance-grist/.test(u));
  const copiesMultiples = [...colles.values()].filter((l) => l.length > 1);
  const nbColles = [...colles.values()].reduce((n, l) => n + l.length, 0);
  const genOk = WIDGETS_GENERIQUES.filter((w) => depot.some((u) => u.includes(w)));
  const detail = [
    `widgets génériques chargés depuis le dépôt : ${genOk.length ? genOk.join(', ') : 'aucun (pages standard à créer)'}`,
    nbColles && `widgets métier collés dans le document : ${nbColles} page(s), ${colles.size} code(s)`,
    copiesMultiples.length && `pages qui partagent un même code (à corriger ensemble) : ${copiesMultiples.map((l) => l.join(' / ')).join(' ; ')}`,
  ].filter(Boolean).join(' ; ');
  return [{ principe: 'P7', objet: 'P7 Widgets', etat: genOk.length ? OK : PARTIEL, detail }];
}

/** Santé générale : formules en erreur, table par table (lecture des données). */
async function controlerFormules(d) {
  const erreurs = [];
  for (const t of d.metier) {
    const lignes = await lireTable(d.docId, t);
    if (!lignes) continue;
    const parCol = {};
    for (const l of lignes) for (const [k, v] of Object.entries(l)) if (Array.isArray(v) && v[0] === 'E') parCol[k] = (parCol[k] || 0) + 1;
    for (const [k, n] of Object.entries(parCol)) erreurs.push(`${t}.${k} (${n})`);
  }
  return [{ principe: 'Santé', objet: 'Formules en erreur', etat: erreurs.length ? ABSENT : OK, detail: erreurs.length ? liste(erreurs) : 'Aucune' }];
}


// =====================================================================
// 5. Mise en forme du rapport
// =====================================================================

/** Tableau Markdown au format de norme/applications/<application>.md. */
function enMarkdown(lignes, titre) {
  const date = new Date().toISOString().slice(0, 10);
  const echappe = (s) => String(s).replace(/\|/g, '\\|');
  return [
    `## État par principe — audit automatique du ${date}`,
    titre ? `Document : ${titre}` : '',
    '',
    '| Principe | État | Détail |',
    '|---|---|---|',
    ...lignes.map((l) => `| ${echappe(l.objet)} | ${l.etat} | ${echappe(l.detail)} |`),
    '',
  ].filter((x, i) => x || i > 1).join('\n');
}


// =====================================================================
// 6. Point d'entrée
// =====================================================================

/**
 * Audite le document et rend { lignes, synthese, markdown }.
 *   lignes   : une ligne par point contrôlé (principe, objet, état, détail) ;
 *   synthese : nombre de points ✅ / ⚠️ / ❌ ;
 *   markdown : le tableau prêt à coller dans le dossier norme/.
 * Affiche aussi le tableau dans la console.
 */
async function auditerNorme({ docId = null, depot = DEPOT_NORME } = {}) {
  const d = await chargerTout(docId || idDuDocument(), depot);
  const lignes = [
    ...controlerSocle(d),
    ...controlerTracabilite(d),
    ...controlerNommage(d),
    ...controlerOrdre(d),
    ...controlerDroits(d),
    ...controlerRegistre(d),
    ...controlerWidgets(d),
    ...(await controlerFormules(d)),
  ];
  const synthese = { conformes: 0, partiels: 0, absents: 0 };
  for (const l of lignes) {
    if (l.etat === OK) synthese.conformes++;
    else if (l.etat === PARTIEL) synthese.partiels++;
    else if (l.etat === ABSENT) synthese.absents++;
  }
  const markdown = enMarkdown(lignes, document.title.replace(/ - Grist$/, ''));
  console.table(lignes.map((l) => ({ Principe: l.objet, État: l.etat, Détail: l.detail })));
  console.log(markdown);
  return { lignes, synthese, markdown };
}
