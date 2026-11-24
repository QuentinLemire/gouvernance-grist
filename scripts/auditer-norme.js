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


/*
 * =====================================================================
 *  Règles de la norme DGOM — contrôles de conformité d'un document Grist
 * =====================================================================
 *
 *  À quoi ça sert
 *  --------------
 *  La norme (norme/principes.md, structure/*.json) est contrôlée à deux endroits :
 *    - la page 🩺 Santé du document de la console d'administration ;
 *    - le script scripts/auditer-norme.js, à coller dans la console du navigateur
 *      pour auditer un document qui n'a pas encore les outils d'administration.
 *  Les règles sont écrites ICI, une seule fois. Le script d'audit est fabriqué à partir
 *  de ce fichier (node scripts/generer-audit.js) : ne jamais le modifier à la main.
 *
 *  Comment l'utiliser
 *  ------------------
 *      const d = Norme.preparer({ tables, colonnes, sections, vues, champs, regles, norme });
 *      const lignes = [...Norme.controler(d), ...await Norme.formules(d, lireTable)];
 *      Norme.enMarkdown(lignes, 'Mon application');
 *  Les tables sont des listes de lignes { id, …colonnes } (tables internes _grist_…).
 *  « regles » vaut null quand on ne peut pas les lire (seuls les propriétaires le peuvent).
 *  « norme » : les sujets de Norme.SUJETS, chacun avec sa définition { tables } (champ « def »).
 *
 *  Chaque contrôle rend des lignes :
 *      { principe, objet, etat, detail, elements, outil }
 *  etat : Norme.OK, Norme.PARTIEL ou Norme.ABSENT (ou ➖ / ❔ quand le point ne s'applique pas) ;
 *  elements : les tables ou colonnes en cause, pour les lister à l'écran ;
 *  outil : le module de la console qui permet de corriger (atelier, droits, maintenance…).
 *
 *  Lecture seule : rien n'est écrit dans le document.
 */
(function (racine) {
  'use strict';

  // --- 1. Réglages de la norme -----------------------------------------------------------------

  /** Dépôt de la norme (branche main) : toujours la version publiée la plus récente. */
  const DEPOT = 'https://raw.githubusercontent.com/QuentinLemire/gouvernance-grist/main/';

  /**
   * Sujets transverses de la norme, dans l'ordre d'installation conseillé.
   * fichier : structure/<fichier>.json sur le dépôt ; obligatoire : sujet du socle (P1).
   */
  const SUJETS = [
    // Socle : présent dans toute application.
    { fichier: 'utilisateurs', nom: 'Utilisateurs & entités', obligatoire: true },
    { fichier: 'parametres', nom: "Paramètres (nom, contact, logo : lus par la page d'accueil)", obligatoire: true },
    { fichier: 'accueil_public', nom: "Page d'accueil publique", obligatoire: true },
    { fichier: 'journal', nom: "Journal d'administration", obligatoire: true },
    // Hors socle : à installer si l'application en a besoin.
    { fichier: 'referentiel_territoires', nom: 'Territoires ultramarins (ajoute aussi Entites.Territoire)', obligatoire: false },
    { fichier: 'support', nom: 'Support', obligatoire: false },
    { fichier: 'documentation', nom: 'Documentation', obligatoire: false },
  ];

  /** Les 4 colonnes de traçabilité (P2) et leur recalcul : 0 = à la création, 2 = à chaque modification. */
  const TRACABILITE = { CreeLe: 0, CreePar: 0, ModifieLe: 2, ModifiePar: 2 };

  /** Rôles génériques (P5). Les rôles métier d'une application s'y ajoutent. */
  const ROLES_GENERIQUES = ['Administrateur', 'Gestionnaire', 'Contributeur', 'Lecteur'];

  /** Pages génériques chargées par adresse depuis le dépôt (P7) ; les deux dernières : avant la console. */
  const WIDGETS_GENERIQUES = ['accueil.html', 'documentation.html', 'support.html', 'console.html', 'administration.html', 'boite-a-outils.html'];

  /** Sites de la norme et de Grist : les appeler n'est pas une sortie à surveiller. */
  const SITES_DE_CONFIANCE = ['quentinlemire.github.io', 'raw.githubusercontent.com', 'api.github.com', 'docs.getgrist.com',
    'grist.numerique.gouv.fr', 'custom-widget-builder', 'getgrist.com', 'Serveur Grist'];

  /**
   * Bibliothèques choisies par la norme, à leur adresse exacte (version figée) : le DSFR (police
   * Marianne, logo), marked et DOMPurify (textes de l'accueil). Le même site appelé pour autre chose
   * reste une sortie « extérieure ».
   */
  const BIBLIOTHEQUES_DE_LA_NORME = ['https://cdn.jsdelivr.net/npm/@gouvfr/dsfr@', 'https://cdnjs.cloudflare.com/ajax/libs/marked/',
    'https://cdnjs.cloudflare.com/ajax/libs/dompurify/'];

  const OK = '✅', PARTIEL = '⚠️', ABSENT = '❌';


  // --- 2. Préparation : index utiles à tous les contrôles ---------------------------------------

  /**
   * Rassemble le document dans une forme pratique pour les contrôles.
   * @param {{tables, colonnes, sections, vues, champs?, regles, norme}} brut  lignes des tables internes
   * @returns {object} d
   */
  function preparer({ tables, colonnes, sections = [], vues = [], champs = [], regles = null, norme = [] }) {
    const colParId = new Map(colonnes.map((c) => [c.id, c]));
    const colonnesDe = new Map();
    for (const t of tables) {
      colonnesDe.set(t.tableId, colonnes
        .filter((c) => c.parentId === t.id && c.colId !== 'manualSort' && !c.colId.startsWith('gristHelper'))
        .sort((a, b) => a.parentPos - b.parentPos));
    }
    // Tables « métier » : hors tables internes, tables de regroupement et tables techniques d'une
    // seule colonne (les « verrous » qui cachent des pages : VueAdmin, VuePilotage, VueBannette…).
    const metier = tables
      .filter((t) => !t.tableId.startsWith('_grist') && !t.tableId.startsWith('GristHidden') && !t.summarySourceTable)
      .map((t) => t.tableId)
      .filter((t) => colonnesDe.get(t).length > 1);
    return { tables, colonnes, sections, vues, champs, regles, norme, colParId, colonnesDe, metier };
  }


  // --- 3. Outils de comparaison ------------------------------------------------------------------

  /** Décrit une colonne au format des fichiers de la norme, pour comparer les deux à l'identique. */
  function decrire(c, colParId) {
    const o = { id: c.colId, label: c.label, type: c.type };
    if (c.isFormula) o.isFormula = true;
    if (c.formula) o.formula = c.formula;
    if (!c.isFormula && c.formula) o.recalcWhen = c.recalcWhen || 0;
    let wo = null; try { wo = JSON.parse(c.widgetOptions || 'null'); } catch (e) { /* options illisibles */ }
    if (wo && Object.keys(wo).length) o.widgetOptions = wo;
    const vis = c.visibleCol && colParId.get(c.visibleCol);
    if (vis) o.visibleCol = vis.colId;
    return o;
  }

  /** Empreinte comparable : clés triées, « isFormula: false » ignoré (certains fichiers l'écrivent). */
  const empreinte = (o) => JSON.stringify(Object.keys(o).filter((k) => !(k === 'isFormula' && o[k] === false)).sort().map((k) => [k, o[k]]));

  /**
   * Une colonne est-elle conforme à sa définition ? Pour une liste de choix (ex. Role), l'application
   * peut AJOUTER des valeurs (rôles métier, P5) : il suffit que les choix de la norme y soient.
   */
  function equivalente(norme, doc) {
    if (norme.type !== 'Choice' && norme.type !== 'ChoiceList') return empreinte(norme) === empreinte(doc);
    const sansOptions = (o) => { const x = { ...o }; delete x.widgetOptions; return x; };
    const choix = (o) => (o.widgetOptions && o.widgetOptions.choices) || [];
    return empreinte(sansOptions(norme)) === empreinte(sansOptions(doc)) && choix(norme).every((c) => choix(doc).includes(c));
  }

  /** État d'un point à partir du nombre d'éléments conformes sur le total. */
  const etat = (bons, total) => (total === 0 || bons === total ? OK : bons === 0 ? ABSENT : PARTIEL);

  /** Courte liste lisible : au plus n éléments, puis « … et N autres ». */
  const liste = (l, n = 6) => (l.length <= n ? l.join(', ') : l.slice(0, n).join(', ') + ` … et ${l.length - n} autres`);

  /** Lit une chaîne JSON sans jamais échouer. */
  const json = (s, defaut) => { try { return JSON.parse(s); } catch (e) { return defaut; } };


  // --- 4. Contrôles de la norme, un par principe -------------------------------------------------

  /** P1 — Socle : chaque table de la norme est-elle présente et complète ? */
  function socle(d) {
    const lignes = [];
    for (const sujet of d.norme) {
      // Module facultatif non installé (aucune de ses tables propres) : ce n'est pas un écart.
      const propres = sujet.def.tables.filter((t) => !t.extension);
      if (!sujet.obligatoire && propres.every((t) => !d.colonnesDe.get(t.tableId))) continue;
      for (const t of sujet.def.tables) {
        const cols = d.colonnesDe.get(t.tableId);
        const objet = `P1 ${t.tableId}` + (t.extension ? ' (colonnes du sujet ' + sujet.fichier + ')' : '') + (sujet.obligatoire ? '' : ' (hors socle)');
        if (!cols) { lignes.push({ principe: 'P1', objet, etat: sujet.obligatoire ? ABSENT : '➖', detail: 'Table absente', elements: [t.tableId], outil: 'maintenance' }); continue; }
        const doc = new Map(cols.map((c) => [c.colId, decrire(c, d.colParId)]));
        const manquantes = t.columns.filter((c) => !doc.has(c.id)).map((c) => c.id);
        const differentes = t.columns.filter((c) => doc.has(c.id) && !equivalente(c, doc.get(c.id))).map((c) => c.id);
        // Colonnes propres à l'application : dans aucun sujet de la norme (une table peut être partagée).
        const deLaNorme = new Set(d.norme.flatMap((x) => x.def.tables.filter((u) => u.tableId === t.tableId).flatMap((u) => u.columns.map((c) => c.id))));
        const ajouts = cols.map((c) => c.colId).filter((id) => !deLaNorme.has(id));
        const detail = [
          manquantes.length && `manquantes : ${liste(manquantes)}`,
          differentes.length && `différentes de la norme : ${liste(differentes)}`,
          ajouts.length && `propres à l'application : ${liste(ajouts)}`,
        ].filter(Boolean).join(' ; ') || 'Conforme';
        lignes.push({ principe: 'P1', objet, etat: etat(t.columns.length - manquantes.length - differentes.length, t.columns.length), detail,
          elements: [...manquantes, ...differentes].map((c) => t.tableId + '.' + c), outil: 'maintenance' });
      }
    }
    return lignes;
  }

  /** P2 — Traçabilité : les 4 colonnes sur chaque table métier, avec le bon recalcul. */
  function tracabilite(d) {
    const sansTout = [], incompletes = [], malReglees = [];
    // Tables du socle sans traçabilité dans la norme (Territoires, Parametres, Accueil) : exclues.
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
    const detail = [
      sansTout.length && `sans traçabilité : ${liste(sansTout)}`,
      incompletes.length && `incomplètes : ${liste(incompletes)}`,
      malReglees.length && `recalcul à corriger (ModifieLe/ModifiePar doivent suivre chaque modification) : ${liste(malReglees)}`,
    ].filter(Boolean).join(' ; ') || `Les ${tables.length} tables métier sont tracées`;
    const e = malReglees.length && !sansTout.length && !incompletes.length ? PARTIEL : etat(tables.length - sansTout.length - incompletes.length, tables.length);
    return [{ principe: 'P2', objet: 'P2 Traçabilité', etat: e, detail, elements: [...sansTout, ...incompletes, ...malReglees], outil: 'atelier' }];
  }

  /**
   * P3 — Nommage : toute colonne commence par une majuscule, sans accent ni espace,
   * et une adresse s'appelle « Courriel », jamais « Email » ni « Mail ».
   */
  function nommage(d) {
    const conforme = (id) => /^[A-Z][A-Za-z0-9_]*$/.test(id);
    const technique = (id) => id === 'manualSort' || id === 'group' || id.startsWith('gristHelper');
    const minuscules = [], courriel = [];
    for (const t of d.metier) {
      for (const c of d.colonnesDe.get(t)) {
        if (technique(c.colId)) continue;
        if (!conforme(c.colId)) minuscules.push(`${t}.${c.colId}`);
        if (/e?mail/i.test(c.colId)) courriel.push(`${t}.${c.colId}`);
      }
    }
    const detail = [
      minuscules.length && `${minuscules.length} colonne(s) sans majuscule initiale : ${liste(minuscules)}`,
      courriel.length && `« Courriel » attendu à la place de : ${liste(courriel)}`,
    ].filter(Boolean).join(' ; ') || 'Conforme';
    return [{ principe: 'P3', objet: 'P3 Nommage', etat: minuscules.length || courriel.length ? PARTIEL : OK, detail,
      elements: [...minuscules, ...courriel], outil: 'atelier' }];
  }

  /** P4 — Ordre : les colonnes de la norme d'abord et dans l'ordre ; la traçabilité en dernier partout. */
  function ordre(d) {
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
    return [{ principe: 'P4', objet: 'P4 Ordre des colonnes', etat: desordre.length || traceAilleurs.length ? PARTIEL : OK, detail,
      elements: [...new Set([...desordre, ...traceAilleurs])], outil: desordre.length ? 'maintenance' : 'atelier' }];
  }

  /** P5 — Droits : attribut user.Profil, rôles génériques, accueil seul pour les non-inscrits, formules valides. */
  function droits(d) {
    if (!d.regles) return [{ principe: 'P5', objet: 'P5 Droits', etat: '❔', detail: 'Règles illisibles : seul un propriétaire du document peut les contrôler', elements: [], outil: 'droits' }];
    const attributs = d.regles.filter((r) => r.userAttributes).map((r) => json(r.userAttributes, {}));
    const profil = attributs.find((a) => a.name === 'Profil');
    const autres = attributs.filter((a) => a.name !== 'Profil').map((a) => `user.${a.name}`);
    const roleCol = (d.colonnesDe.get('Gouv_Utilisateurs') || []).find((c) => c.colId === 'Role' || c.colId === 'role');
    const roles = json(roleCol?.widgetOptions || '{}', {}).choices || [];
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
    return [{ principe: 'P5', objet: 'P5 Droits', etat: etat(points.filter(Boolean).length, points.length), detail,
      elements: manquants.map((r) => 'rôle ' + r), outil: 'droits' }];
  }

  /** P6 — Un seul registre : repère les tables qui recopient presque toutes les colonnes d'une autre. */
  function registre(d) {
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
      detail: copies.length ? `tables qui se recopient : ${copies.join(' ; ')}` : 'Aucune table recopiée', elements: copies, outil: 'explorateur' }];
  }

  /**
   * P7 — Widgets : les génériques sont chargés par adresse depuis le dépôt. Les widgets métier
   * peuvent rester collés dans le document : ils sont seulement recensés (et les copies d'un même code).
   */
  function widgets(d) {
    const nomVue = new Map(d.vues.map((v) => [v.id, v.name]));
    const colles = new Map(), urls = [];
    for (const s of d.sections) {
      const cv = json(json(s.options || '{}', {}).customView || 'null', null);
      if (!cv) continue;
      const code = cv.widgetOptions?._js;
      if (code) {
        const cle = code.length + ':' + code.slice(0, 200);
        colles.set(cle, [...(colles.get(cle) || []), nomVue.get(s.parentId) || `section ${s.id}`]);
      } else if (cv.url) urls.push(cv.url);
    }
    const depot = urls.filter((u) => /gouvernance-grist/.test(u));
    const copiesMultiples = [...colles.values()].filter((l) => l.length > 1);
    const nbColles = [...colles.values()].reduce((n, l) => n + l.length, 0);
    const generiques = WIDGETS_GENERIQUES.filter((w) => depot.some((u) => u.split('?')[0].endsWith('/' + w)));
    const detail = [
      `widgets génériques chargés depuis le dépôt : ${generiques.length ? generiques.join(', ') : 'aucun (pages standard à créer)'}`,
      nbColles && `widgets métier collés dans le document : ${nbColles} page(s), ${colles.size} code(s)`,
      copiesMultiples.length && `pages qui partagent un même code (à corriger ensemble) : ${copiesMultiples.map((l) => l.join(' / ')).join(' ; ')}`,
    ].filter(Boolean).join(' ; ');
    return [{ principe: 'P7', objet: 'P7 Widgets', etat: generiques.length ? OK : PARTIEL, detail,
      elements: copiesMultiples.map((l) => l.join(' / ')), outil: 'maintenance' }];
  }

  /** Tous les contrôles de la norme (P1 à P7), sans lecture des données. */
  const controler = (d) => [...socle(d), ...tracabilite(d), ...nommage(d), ...ordre(d), ...droits(d), ...registre(d), ...widgets(d)];


  // --- 5. Santé générale du document -------------------------------------------------------------

  /**
   * Formules en erreur, table par table (lit les données).
   * @param {Function} lireTable  async (tableId) → lignes { id, … } ou null
   */
  async function formules(d, lireTable) {
    const erreurs = [];
    for (const t of d.metier) {
      const lignes = await lireTable(t);
      if (!lignes) continue;
      const parCol = {};
      for (const l of lignes) for (const [k, v] of Object.entries(l)) if (Array.isArray(v) && v[0] === 'E') parCol[k] = (parCol[k] || 0) + 1;
      for (const [k, n] of Object.entries(parCol)) erreurs.push(`${t}.${k} (${n} ligne${n > 1 ? 's' : ''})`);
    }
    return [{ principe: 'Santé', objet: 'Formules en erreur', etat: erreurs.length ? ABSENT : OK,
      detail: erreurs.length ? liste(erreurs) : 'Aucune', elements: erreurs, outil: 'atelier' }];
  }

  /**
   * Colonnes de données qui ne servent nulle part : affichées dans aucune vue, citées par aucune
   * formule, aucune règle d'accès, ni aucun widget. Ce sont des candidates à vérifier, pas des
   * erreurs : une colonne peut être remplie par un import, ou lue par un autre document.
   * @param {Set<string>} [luesParWidgets]  colonnes « Table.Colonne » lues par les widgets
   */
  function colonnesInutilisees(d, luesParWidgets = new Set()) {
    const affichees = new Set(d.champs.map((f) => f.colRef));
    const textes = [...d.colonnes.map((c) => c.formula || ''), ...(d.regles || []).map((r) => r.aclFormula || '')].join('\n');
    const citee = (id) => new RegExp('[.$]' + id + '\\b').test(textes);
    const inutiles = [];
    for (const t of d.metier) {
      for (const c of d.colonnesDe.get(t)) {
        if (c.isFormula || c.colId in TRACABILITE || c.colId === 'group') continue;
        if (affichees.has(c.id) || citee(c.colId) || luesParWidgets.has(t + '.' + c.colId)) continue;
        // référence vers une autre table : citée par sa colonne d'affichage, c'est un lien utile
        if (/^Ref/.test(c.type) && d.colonnes.some((x) => x.formula && x.formula.includes('$' + c.colId))) continue;
        inutiles.push(`${t}.${c.colId}`);
      }
    }
    return [{ principe: 'Santé', objet: 'Colonnes inutilisées', etat: inutiles.length ? PARTIEL : OK,
      detail: inutiles.length ? `${inutiles.length} colonne(s) affichée(s) nulle part et lue(s) par rien : ${liste(inutiles)}` : 'Toutes les colonnes servent',
      elements: inutiles, outil: 'explorateur' }];
  }

  /** Un domaine internet est-il de confiance (dépôt de la norme, Grist) ? */
  const deConfiance = (domaine) => SITES_DE_CONFIANCE.some((s) => String(domaine).includes(s));

  /** Adresse d'une bibliothèque choisie par la norme ? */
  const bibliothequeDeLaNorme = (url) => BIBLIOTHEQUES_DE_LA_NORME.some((p) => String(url).startsWith(p));

  /**
   * Genre d'une sortie { domaine, adresses } : « grist » (norme ou Grist), « bibliotheque »
   * (bibliothèque choisie par la norme) ou « exterieur » (à surveiller).
   */
  function genreSortie(s) {
    if (deConfiance(s.domaine)) return 'grist';
    return (s.adresses || []).length && s.adresses.every((a) => bibliothequeDeLaNorme(a.url)) ? 'bibliotheque' : 'exterieur';
  }

  /** Widget servi par le dépôt de la norme (accueil, console…) : relu, et prévu pour les modules facultatifs. */
  const widgetDeLaNorme = (a) => /\/gouvernance-grist\//.test(a.url || '');

  /**
   * Widgets : tables citées mais absentes, sorties vers des sites extérieurs, jetons d'accès.
   * @param {object[]} analyses  résultats de Structure.analyserWidget, avec « page » (chemin de la page)
   */
  function analyseWidgets(analyses) {
    const lignes = [];
    // Les widgets de la norme citent les tables des modules facultatifs (Support, Documentation) et
    // vérifient leur présence avant de les lire : une absence n'y est pas une erreur.
    const absentes = analyses.filter((a) => a.absentes.length && !widgetDeLaNorme(a)).map((a) => `${a.page} : ${a.absentes.join(', ')}`);
    lignes.push({ principe: 'Santé', objet: 'Widgets : tables introuvables', etat: absentes.length ? ABSENT : OK,
      detail: absentes.length ? `widgets qui lisent ou écrivent une table absente du document : ${liste(absentes)}` : 'Toutes les tables citées existent',
      elements: absentes, outil: 'explorateur' });
    const exterieures = analyses.flatMap((a) => a.sorties.filter((s) => genreSortie(s) === 'exterieur').map((s) => `${a.page} → ${s.domaine}`));
    lignes.push({ principe: 'Santé', objet: 'Widgets : sorties vers internet', etat: exterieures.length ? PARTIEL : OK,
      detail: exterieures.length ? `appels vers des sites extérieurs à la norme : ${liste(exterieures)}` : 'Aucun appel hors du dépôt, de Grist et des bibliothèques de la norme',
      elements: exterieures, outil: 'explorateur' });
    // les outils d'administration de la norme ont besoin du jeton : seuls les widgets métier sont signalés
    const jetons = analyses.filter((a) => a.jeton && !widgetDeLaNorme(a)).map((a) => a.page);
    if (jetons.length) lignes.push({ principe: 'Santé', objet: 'Widgets : jeton d\'accès', etat: PARTIEL,
      detail: `widgets métier qui demandent un jeton d'accès au document (à réserver aux outils d'administration) : ${liste(jetons)}`,
      elements: jetons, outil: 'explorateur' });
    const illisibles = analyses.filter((a) => a.illisible).map((a) => a.page);
    if (illisibles.length) lignes.push({ principe: 'Santé', objet: 'Widgets : code illisible', etat: '❔',
      detail: `code impossible à télécharger, donc non analysé : ${liste(illisibles)}`, elements: illisibles, outil: 'explorateur' });
    return lignes;
  }


  // --- 6. Rapport --------------------------------------------------------------------------------

  /** Nombre de points conformes, à améliorer, à corriger. */
  function synthese(lignes) {
    return {
      conformes: lignes.filter((l) => l.etat === OK).length,
      partiels: lignes.filter((l) => l.etat === PARTIEL).length,
      absents: lignes.filter((l) => l.etat === ABSENT).length,
    };
  }

  /** Tableau Markdown au format de norme/applications/<application>.md. */
  function enMarkdown(lignes, titre) {
    const date = new Date().toISOString().slice(0, 10);
    const echappe = (s) => String(s).replace(/\|/g, '\\|');
    return [
      `## État par principe — audit automatique du ${date}`,
      ...(titre ? [`Document : ${titre}`] : []),
      '',
      '| Principe | État | Détail |',
      '|---|---|---|',
      ...lignes.map((l) => `| ${echappe(l.objet)} | ${l.etat} | ${echappe(l.detail)} |`),
      '',
    ].join('\n');
  }

  /** Lit les définitions des sujets de la norme sur le dépôt. */
  async function lireNorme(depot = DEPOT) {
    return Promise.all(SUJETS.map(async (s) => {
      const r = await fetch(depot + `structure/${s.fichier}.json`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`Norme : structure/${s.fichier}.json introuvable (${r.status})`);
      return { ...s, def: await r.json() };
    }));
  }

  const Norme = {
    DEPOT, SUJETS, TRACABILITE, ROLES_GENERIQUES, WIDGETS_GENERIQUES, OK, PARTIEL, ABSENT,
    preparer, controler, formules, colonnesInutilisees, analyseWidgets, genreSortie, synthese, enMarkdown, lireNorme,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Norme;
  else racine.Norme = Norme;
})(typeof window !== 'undefined' ? window : globalThis);


// --- Point d'entrée du script : lecture par l'API du document, puis les contrôles de Norme ---------

/** Identifiant du document ouvert, lu dans l'adresse de la page. */
function idDuDocument() {
  const m = location.pathname.match(/\/(?:o\/[^/]+\/)?([A-Za-z0-9]{12,})(?:\/|$)/);
  if (!m) throw new Error("Impossible de trouver l'identifiant du document dans l'adresse.");
  return m[1];
}

/**
 * Lit toutes les lignes d'une table (y compris les tables internes _grist_…), en { id, …colonnes }.
 * On passe par /records plutôt que par /sql, que le pare-feu de grist.numerique.gouv.fr bloque parfois.
 * Rend null si la table n'existe pas ou n'est pas lisible.
 */
async function lireTable(docId, table) {
  const r = await fetch(`/api/docs/${docId}/tables/${table}/records?hidden=true`, { credentials: 'include' });
  if (!r.ok) return null;
  return (await r.json()).records.map((x) => ({ id: x.id, ...x.fields }));
}

/**
 * Audite le document et rend { lignes, synthese, markdown } ; affiche aussi le tableau dans la console.
 */
async function auditerNorme({ docId = null, depot = Norme.DEPOT } = {}) {
  docId = docId || idDuDocument();
  const lire = (t) => lireTable(docId, t);
  const [tables, colonnes, sections, vues, champs, regles] = await Promise.all(
    ['_grist_Tables', '_grist_Tables_column', '_grist_Views_section', '_grist_Views', '_grist_Views_section_field', '_grist_ACLRules'].map(lire));
  const d = Norme.preparer({ tables, colonnes, sections, vues, champs,
    // un non-propriétaire reçoit une liste vide : les règles sont alors illisibles, pas absentes
    regles: regles && regles.length ? regles : null,
    norme: await Norme.lireNorme(depot) });
  const lignes = [...Norme.controler(d), ...(await Norme.formules(d, lire)), ...Norme.colonnesInutilisees(d)];
  const synthese = Norme.synthese(lignes);
  const markdown = Norme.enMarkdown(lignes, document.title.replace(/ - Grist$/, ''));
  console.table(lignes.map((l) => ({ Principe: l.objet, État: l.etat, Détail: l.detail })));
  console.log(markdown);
  return { lignes, synthese, markdown };
}
